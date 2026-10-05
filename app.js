/* =====================================================================
   CRM de Prospecção — interface e regras do funil
   ===================================================================== */
import * as db from './db.js';

/* ================= Configuração do funil ================= */
const STAGES = [
  {id:'leads',nome:'Leads',cor:'rgb(var(--t1))'},
  {id:'prospeccao',nome:'Em prospecção',cor:'rgb(var(--t2))'},
  {id:'triagem',nome:'Reunião de triagem',cor:'rgb(var(--t3))'},
  {id:'proposta',nome:'Reunião de proposta',cor:'rgb(var(--t4))'},
  {id:'followup',nome:'Follow-up',cor:'rgb(var(--t5))'},
  {id:'negociacao',nome:'Em negociação',cor:'rgb(var(--t6))'},
  {id:'ganho',nome:'Ganho',cor:'rgb(var(--win))'},
  {id:'perdido',nome:'Perdido',cor:'rgb(var(--lost))'}
];
const STAGE = Object.fromEntries(STAGES.map(s=>[s.id,s]));
const MOTIVOS = [
  {id:'Sem perfil',dica:'Revise o perfil do cliente ideal antes de montar a lista.'},
  {id:'Financeiro',dica:'Se você escolhe quem aborda e eles querem pagar pouco, o erro está na seleção. Reveja lista, preço e posicionamento.'},
  {id:'Desistência',dica:'Follow-up fraco ou pouco valor gerado na call de vendas.'},
  {id:'Concorrência',dica:'Sempre pergunte por que o lead escolheu o concorrente.'},
  {id:'Sem contato',dica:'Lista ruim ou desatualizada, ou abordagem que não desperta interesse. Diversifique os canais e revise o script.'},
  {id:'Spam',dica:'Dados errados. Comum em leads de tráfego pago.'}
];
const MAX_TENT = 5, MAX_FUP = 5;
const svg = p => `<svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = {
  hoje: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  funil: svg('<path d="M3 4h18l-7 9v6l-4 2v-8z"/>'),
  lista: svg('<path d="M12 5v14M5 12h14"/>'),
  prospeccao: svg('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>'),
  agendamentos: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  followup: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  negociacao: svg('<path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>'),
  perdidos: svg('<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>')
};
const VIEWS = [
  {id:'hoje',nome:'Hoje'},
  {id:'funil',nome:'Funil'},
  {id:'lista',nome:'Criação de lista'},
  {id:'prospeccao',nome:'Prospecção'},
  {id:'agendamentos',nome:'Agendamentos'},
  {id:'followup',nome:'Follow-up'},
  {id:'negociacao',nome:'Negociação'},
  {id:'perdidos',nome:'Perdidos'}
];

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const cx = (...a) => a.filter(Boolean).join(' ');
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const addDays = n => { const d = new Date(); d.setDate(d.getDate()+n); return iso(d); };
const DIAS = ['dom','seg','ter','qua','qui','sex','sáb'];
function fmtDate(s){
  if(!s) return 'Sem data';
  if(s===today()) return 'Hoje';
  if(s===addDays(1)) return 'Amanhã';
  if(s===addDays(-1)) return 'Ontem';
  const d = new Date(s+'T12:00');
  return `${DIAS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
}
const dateClass = s => !s ? '' : s < today() ? 'font-bold text-t6' : s === today() ? 'font-bold text-ink' : '';
const money = n => (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'').slice(0,20) : Date.now().toString(36)+Math.random().toString(36).slice(2,10));
const due = l => l.data && l.data <= today();
const byDate = (a,b) => (a.data||'9999').localeCompare(b.data||'9999') || (a.hora||'').localeCompare(b.hora||'');
const novoLead = (extra={}) => ({id:uid(),empresa:'',contato:'',email:'',telefone:'',cnpj:'',instagram:'',linkedin:'',site:'',status:'leads',tentativa:0,fup:0,data:today(),hora:'',valor:0,motivo:'',notas:'',criadoEm:today(),...extra});

/* ================= Componentes base (Tailwind) ================= */
const BTN = {
  base:'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
  md:'px-3.5 py-2 text-sm', sm:'px-2.5 py-1 text-[13px]', lg:'w-full px-4 py-3 text-[15px]',
  default:'border-line bg-surface text-ink hover:border-muted',
  primary:'border-ink bg-ink text-bg hover:opacity-90',
  ghost:'border-transparent bg-transparent text-muted hover:bg-surface2 hover:text-ink',
  danger:'border-transparent bg-transparent text-t6 hover:bg-t6/10'
};
function btn(label,{act,id,view,variant='default',size='md',type='button',attrs=''}={}){
  return `<button type="${type}" class="${cx(BTN.base,BTN[size],BTN[variant])}"${act?` data-act="${act}"`:''}${id?` data-id="${id}"`:''}${view?` data-view="${view}"`:''} ${attrs}>${label}</button>`;
}
const PANEL = 'rounded-2xl border border-line bg-surface p-4 md:p-5';
const H2 = 'mb-3 font-display text-[19px] font-bold tracking-tight';
const tag = (t, style='') => `<span class="whitespace-nowrap rounded-full bg-surface2 px-2 py-px text-xs font-bold text-muted" ${style}>${t}</span>`;
const dot = cor => `<i class="inline-block h-2 w-2 shrink-0 rounded-full" style="background:${cor}"></i>`;
const empty = t => `<p class="py-1.5 text-[13px] text-muted">${t}</p>`;
const INPUT = 'w-full min-w-0 rounded-md border border-line bg-surface2 px-2.5 py-2 text-sm text-ink placeholder:text-muted/70';
function field({name,label,type='text',value='',full=false,required=false,options=null,placeholder='',id}){
  id = id || 'f_'+name;
  const wrap = cx('flex min-w-0 flex-col gap-1', full && 'sm:col-span-2');
  const lab = `<label for="${id}" class="text-xs font-bold text-muted">${label}</label>`;
  if(options) return `<div class="${wrap}">${lab}<select id="${id}" name="${name}" class="${INPUT}">${options.map(o=>{const v=typeof o==='object'?o.value:o, t=typeof o==='object'?o.label:o; return `<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`;}).join('')}</select></div>`;
  if(type==='textarea') return `<div class="${wrap}">${lab}<textarea id="${id}" name="${name}" class="${INPUT} min-h-[80px]" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`;
  return `<div class="${wrap}">${lab}<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" class="${INPUT}" ${required?'required':''}></div>`;
}

/* ================= Estado ================= */
let user = null;
let leads = [];
let loaded = false;
let unsubscribe = null;
let view = (()=>{ try{ return localStorage.getItem('crm-prospeccao:view') || 'hoje'; }catch(e){ return 'hoje'; } })();
const setView = v => { view = v; try{ localStorage.setItem('crm-prospeccao:view', v); }catch(e){} };
const get = id => leads.find(l=>l.id===id);
const inStage = id => leads.filter(l=>l.status===id);

/* ================= Persistência ================= */
const fail = e => { console.error(e); toast('Não foi possível salvar. Verifique a conexão e tente de novo.'); };
function persist(l){
  const i = leads.findIndex(x=>x.id===l.id);
  if(i<0) leads.push(l); else leads[i] = l;
  db.saveLead(l).catch(fail);
}
function commit(l){ persist(l); render(); if(drawerId) openDrawer(drawerId); }

/* ================= Automações ================= */
function registrarTentativa(l){
  if(l.tentativa >= MAX_TENT){ Object.assign(l,{status:'perdido',motivo:'Sem contato',data:''}); toast(`${l.empresa}: 5 tentativas sem resposta. Movido para Perdido.`); return; }
  l.tentativa++; l.status='prospeccao'; l.data=addDays(1);
  toast(`Tentativa ${l.tentativa} registrada. Próxima: amanhã.`);
}
function registrarFup(l){
  if(l.fup >= MAX_FUP){ Object.assign(l,{status:'perdido',motivo:'Desistência',data:''}); toast(`${l.empresa}: sem resposta após o FUP 5. Perdido por desistência.`); return; }
  l.fup++; l.data=addDays(1);
  toast(`FUP ${l.fup} registrado. Próximo: amanhã.`);
}

/* ================= Cards ================= */
function metaFor(l){
  const m = [];
  if(l.status==='leads') m.push(tag('Não abordado'));
  if(l.status==='prospeccao') m.push(tag(`Tentativa ${l.tentativa}`));
  if(l.status==='followup') m.push(tag(`FUP ${l.fup}`));
  if(l.status==='perdido' && l.motivo) m.push(tag(esc(l.motivo)));
  if(!['ganho','perdido'].includes(l.status)) m.push(`<span class="${dateClass(l.data)}">${fmtDate(l.data)}${l.hora?' às '+esc(l.hora):''}</span>`);
  if(l.contato) m.push(`<span>${esc(l.contato)}</span>`);
  return m.join('');
}
function actionsFor(l){
  const b = (act,label,variant) => btn(label,{act,id:l.id,size:'sm',variant});
  switch(l.status){
    case 'leads':
    case 'prospeccao':
      return b('tentativa', l.tentativa>=MAX_TENT ? 'Encerrar sem contato' : 'Sem resposta') + b('triagem','Marcou triagem','primary') + b('perder','Perdido','ghost');
    case 'triagem':
      return b('proposta','Tem perfil: marcar proposta','primary') + b('perder','Sem perfil','ghost');
    case 'proposta':
      return b('irFup','Precisa pensar') + b('negociar','Quase fechado','primary') + b('perder','Perdido','ghost');
    case 'followup':
      return b('fup', l.fup>=MAX_FUP ? 'Encerrar: desistência' : 'Sem resposta') + b('negociar','Vai fechar','primary') + b('perder','Perdido','ghost');
    case 'negociacao':
      return b('reagendar','Reagendar') + b('ganhar','Fechou','primary') + b('perder','Não fechou','ghost');
    case 'perdido':
      return b('reativar','Reativar lead');
    default: return '';
  }
}
function card(l,{compact=false}={}){
  return `<article class="flex flex-col gap-1.5 rounded-xl border border-l-4 border-line bg-surface px-3.5 py-3" style="border-left-color:${STAGE[l.status].cor}">
    <div class="flex items-start justify-between gap-2">
      <button class="text-left text-[15px] font-bold leading-snug hover:underline" data-act="abrir" data-id="${l.id}">${esc(l.empresa)}</button>
      ${l.valor ? `<span class="whitespace-nowrap text-[13px] font-bold">${money(l.valor)}</span>`:''}
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">${metaFor(l)}</div>
    ${compact ? '' : `<div class="mt-0.5 flex flex-wrap gap-1.5">${actionsFor(l)}</div>`}
  </article>`;
}
const cards = (arr, opts) => arr.length ? `<div class="flex flex-col gap-2">${arr.map(l=>card(l,opts)).join('')}</div>` : '';
const column = (title, cor, items, {sum=0, opts}={}) => `<section class="min-w-0 rounded-2xl border border-line bg-surface2 p-3">
    <div class="mb-2.5 flex items-center gap-2 text-sm font-bold">${dot(cor)}${title}<span class="ml-auto text-[13px] text-muted">${items.length}</span></div>
    ${sum?`<div class="-mt-1.5 mb-2.5 text-xs text-muted">${money(sum)}</div>`:''}
    ${cards(items,opts) || empty('Vazio')}
  </section>`;
const BOARD = 'grid items-start gap-3.5 pb-2.5 md:grid-flow-col md:auto-cols-[minmax(250px,46%)] md:overflow-x-auto lg:auto-cols-[minmax(260px,1fr)]';
const GRID_CARDS = 'grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr))]';
function header(title, sub, withBtn=true){
  return `<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
    <div><h1 class="font-display text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">${title}</h1>${sub?`<p class="mt-1 max-w-[62ch] text-sm text-muted">${sub}</p>`:''}</div>
    ${withBtn?`<div class="hidden md:block">${btn('Novo lead',{act:'novo',variant:'primary'})}</div>`:''}
  </div>`;
}

/* ================= Visões ================= */
function vHoje(){
  const ativos = ['leads','prospeccao','triagem','proposta','followup','negociacao'];
  const counts = ativos.map(s=>inStage(s).length);
  const total = counts.reduce((a,b)=>a+b,0);
  const mes = today().slice(0,7);
  const fat = leads.filter(l=>l.status==='ganho' && (l.ganhoEm||'').startsWith(mes)).reduce((a,l)=>a+(+l.valor||0),0);
  const aberto = leads.filter(l=>['proposta','followup','negociacao'].includes(l.status)).reduce((a,l)=>a+(+l.valor||0),0);
  const dataLonga = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const destino = s => ({leads:'prospeccao',prospeccao:'prospeccao',triagem:'agendamentos',proposta:'agendamentos',followup:'followup',negociacao:'negociacao'})[s];

  if(!leads.length) return header('Rotina de hoje', 'Seu funil está vazio.') + `
    <section class="${PANEL} max-w-xl">
      <h2 class="${H2}">Comece pela lista</h2>
      <p class="mb-4 text-sm text-muted">Monte uma lista com pelo menos 50 contatos e importe da sua planilha. Se preferir, carregue alguns leads de exemplo para conhecer o CRM.</p>
      <div class="flex flex-wrap gap-2">${btn('Criar lista',{view:'lista',variant:'primary'})}${btn('Carregar exemplos',{act:'exemplos'})}</div>
    </section>`;

  const steps = [
    {n:1,st:['negociacao'],t:'Leads em negociação',w:'Mais perto da compra.'},
    {n:2,st:['followup'],t:'Follow-ups',w:'Já viram a proposta.'},
    {n:3,st:['triagem','proposta'],t:'Reuniões agendadas',w:'Confirme, envie o link e prepare o material.'},
    {n:4,st:['leads','prospeccao'],t:'Prospecções',w:'Tentativas com data de hoje.'}
  ];
  const paraProspectar = inStage('leads').length + inStage('prospeccao').length;
  const step = (n, cor, t, w, body) => `<div class="border-l-[3px] py-0.5 pl-3.5" style="border-color:${cor}">
      <div class="mb-2 flex flex-wrap items-baseline gap-x-2.5"><span class="font-display text-[15px] font-bold" style="color:${cor}">${n}º</span><h3 class="text-[15px] font-bold">${t}</h3><span class="text-[13px] text-muted">${w}</span></div>
      ${body}</div>`;
  const rotina = steps.map(s=>{
    const arr = leads.filter(l=>s.st.includes(l.status) && due(l)).sort(byDate);
    return step(s.n, STAGE[s.st[0]].cor, s.t, s.w, cards(arr) || empty('Nada para hoje. Passe para a próxima etapa.'));
  }).join('') + step(5, STAGE.leads.cor, 'Adicionar novos leads', 'Retroalimente o funil.',
    `<div class="flex flex-wrap items-center gap-2 py-1 text-[13px] text-muted"><span>${paraProspectar} leads em prospecção.${paraProspectar<50?' A meta é manter pelo menos 50.':''}</span>${btn('Criar lista',{view:'lista',size:'sm'})}</div>`);

  return header('Rotina de hoje', dataLonga.charAt(0).toUpperCase()+dataLonga.slice(1)+'. Do lead mais quente ao mais frio.') + `
  <section class="${PANEL} mb-5" aria-label="Leads no funil">
    <div class="flex items-baseline justify-between gap-2.5 text-[13px] font-semibold text-muted"><span>Leads no funil</span><span><strong class="text-ink">${total}</strong> ativos</span></div>
    <div class="my-3 flex h-3.5 overflow-hidden rounded-full bg-surface2">${ativos.map((s,i)=>`<span class="block h-full transition-all" style="flex-grow:${counts[i]};background:${STAGE[s].cor}" title="${STAGE[s].nome}: ${counts[i]}"></span>`).join('')}</div>
    <div class="grid grid-cols-3 gap-x-2 gap-y-3 lg:grid-cols-6">${ativos.map((s,i)=>`<button class="text-left" data-view="${destino(s)}"><b class="block font-display text-[22px] leading-tight md:text-[26px]">${counts[i]}</b><small class="flex items-center gap-1.5 text-xs font-semibold text-muted">${dot(STAGE[s].cor)}${STAGE[s].nome}</small></button>`).join('')}</div>
  </section>
  <div class="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
    <section class="${PANEL}"><h2 class="${H2}">O que fazer agora</h2><div class="flex flex-col gap-4">${rotina}</div></section>
    <div class="flex flex-col gap-5">
      <section class="${PANEL}"><h2 class="${H2}">Faturamento</h2>
        <div class="flex flex-wrap gap-7"><div><b class="block font-display text-2xl">${money(fat)}</b><small class="text-[13px] text-muted">Fechado no mês</small></div><div><b class="block font-display text-2xl">${money(aberto)}</b><small class="text-[13px] text-muted">Em propostas abertas</small></div></div>
      </section>
      <section class="${PANEL}"><h2 class="${H2}">Motivos de perda</h2>${lossBars()}</section>
    </div>
  </div>`;
}
function lossBars(){
  const perd = inStage('perdido');
  if(!perd.length) return empty('Nenhum lead perdido ainda. Ao perder um, registre o motivo para analisar depois.');
  const rows = MOTIVOS.map(m=>({m, n:perd.filter(l=>l.motivo===m.id).length})).filter(r=>r.n).sort((a,b)=>b.n-a.n);
  if(!rows.length) return empty('Os leads perdidos estão sem motivo. Edite-os para registrar.');
  return `<div class="flex flex-col gap-2.5">${rows.map(r=>{const p=Math.round(r.n/perd.length*100);return `<div class="grid grid-cols-[92px_1fr_40px] items-center gap-2.5 text-[13px] md:grid-cols-[110px_1fr_44px]"><span>${r.m.id}</span><div class="h-2.5 overflow-hidden rounded-full bg-surface2"><div class="h-full rounded-full bg-lost" style="width:${p}%"></div></div><span class="text-right font-bold">${p}%</span></div>`}).join('')}</div>
  <p class="mt-3 border-t border-line pt-3 text-[13px] text-muted"><strong class="text-ink">${rows[0].m.id}</strong> lidera. ${rows[0].m.dica}</p>`;
}
function vFunil(){
  return header('Funil','Todos os leads em suas fases.') + `<div class="${BOARD}">${STAGES.map(s=>{
    const arr = inStage(s.id).sort(byDate);
    return column(s.nome, s.cor, arr, {sum:arr.reduce((a,l)=>a+(+l.valor||0),0), opts:{compact:true}});
  }).join('')}</div>`;
}
function vProspeccao(){
  const arr = leads.filter(l=>['leads','prospeccao'].includes(l.status));
  const grupos = [{t:0,nome:'Não abordado'}].concat(Array.from({length:MAX_TENT},(_,i)=>({t:i+1,nome:`Tentativa ${i+1}`})));
  return header('Prospecção','Aja só nas tarefas com data de hoje. Cada tentativa sem resposta agenda a próxima para amanhã; depois da 5ª, o lead vai para Perdido.') +
  `<div class="${BOARD}">${grupos.map(g=>column(g.nome, g.t?STAGE.prospeccao.cor:STAGE.leads.cor, arr.filter(l=>(l.status==='leads'?0:l.tentativa)===g.t).sort(byDate))).join('')}</div>`;
}
function vAgendamentos(){
  const arr = leads.filter(l=>['triagem','proposta'].includes(l.status)).sort(byDate);
  const t = today();
  const g = [
    {nome:'Não ocorreram',it:arr.filter(l=>l.data && l.data<t)},
    {nome:'Hoje',it:arr.filter(l=>l.data===t)},
    {nome:'Próximas',it:arr.filter(l=>!l.data || l.data>t)}
  ];
  return header('Agendamentos','Reuniões de triagem e de proposta por data. Na triagem, descubra se consegue vender: faturamento, funcionários, quanto já investem e quanto pretendem investir.') +
  `<div class="flex flex-col gap-6">${g.map(x=>`<section><div class="mb-2 flex items-center gap-2 text-sm font-bold text-muted">${x.nome}<span class="font-semibold">${x.it.length}</span></div>${x.it.length?`<div class="${GRID_CARDS}">${x.it.map(l=>card(l)).join('')}</div>`:empty('Nenhuma reunião.')}</section>`).join('')}</div>`;
}
function vFollowup(){
  const arr = inStage('followup');
  return header('Follow-up','Funciona como a prospecção: tentativas numeradas. Após o FUP 5 sem resposta, o lead é perdido por desistência.') +
  `<div class="${BOARD}">${Array.from({length:MAX_FUP},(_,i)=>i+1).map(n=>{
    const it = arr.filter(l=>l.fup===n).sort(byDate);
    return column(`FUP ${n}`, STAGE.followup.cor, it, {sum:it.reduce((a,l)=>a+(+l.valor||0),0)});
  }).join('')}</div>`;
}
function vNegociacao(){
  const arr = inStage('negociacao').sort(byDate);
  const soma = arr.reduce((a,l)=>a+(+l.valor||0),0);
  return header('Em negociação','O cliente já decidiu e está esperando algo específico. Sem follow-ups fixos: agende pela data que ele combinou.') +
  `<section class="${PANEL} mb-4"><div class="flex flex-wrap gap-7"><div><b class="block font-display text-2xl">${arr.length}</b><small class="text-[13px] text-muted">Contratos em negociação</small></div><div><b class="block font-display text-2xl">${money(soma)}</b><small class="text-[13px] text-muted">Em jogo para fechamento</small></div></div></section>
  ${arr.length?`<div class="${GRID_CARDS}">${arr.map(l=>card(l)).join('')}</div>`:empty('Nenhum lead em negociação.')}`;
}
function vPerdidos(){
  const perd = inStage('perdido');
  const semMotivo = perd.filter(l=>!MOTIVOS.some(m=>m.id===l.motivo));
  const grupos = MOTIVOS.map(m=>({nome:m.id, it:perd.filter(l=>l.motivo===m.id)})).concat([{nome:'Sem motivo', it:semMotivo}]).filter(g=>g.it.length);
  return header('Perdidos','Separados por motivo. Quando um lead perdido responder depois de semanas, reative: ele volta para a Tentativa 1.') +
  `<div class="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]"><div class="flex flex-col gap-6">${grupos.map(g=>`<section><div class="mb-2 flex items-center gap-2 text-sm font-bold text-muted">${g.nome}<span class="font-semibold">${g.it.length}</span></div>${cards(g.it)}</section>`).join('') || empty('Nenhum lead perdido.')}</div>
  <section class="${PANEL}"><h2 class="${H2}">Análise</h2>${lossBars()}</section></div>`;
}
function vLista(){
  const novos = inStage('leads');
  const td = 'border-b border-line px-3.5 py-2.5';
  return header('Criação de lista','Reserve um período fixo para montar listas, como sexta à tarde, segunda de manhã ou sábado. Meta: pelo menos 50 leads.', false) +
  `<div class="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
    <section class="${PANEL}">
      <h2 class="${H2}">Importar do Google Sheets</h2>
      <ol class="mb-3 list-decimal pl-5 text-sm text-muted"><li class="mb-1.5">Organize as colunas nesta ordem: nome da empresa, nome do contato, e-mail, telefone.</li><li>Selecione as linhas na planilha, copie e cole abaixo.</li></ol>
      <label for="importBox" class="sr-only">Linhas da planilha</label>
      <textarea id="importBox" class="min-h-[220px] w-full resize-y rounded-xl border border-line bg-surface p-3 text-sm placeholder:text-muted/70" placeholder="Empresa&#9;Contato&#9;E-mail&#9;Telefone&#10;Padaria Exemplo&#9;Ana&#9;ana@exemplo.com&#9;(11) 90000-0000"></textarea>
      <div class="mt-3 flex flex-wrap gap-2">${btn('Importar leads',{act:'importar',variant:'primary'})}${btn('Adicionar um lead',{act:'novo'})}</div>
    </section>
    <section class="${PANEL}">
      <h2 class="${H2}">Enriqueça antes de abordar</h2>
      <ol class="text-sm">${['Pesquise a empresa no Google.','Descubra o CNPJ.','Pelo CNPJ, descubra o nome do sócio.','Veja se o Instagram da empresa segue alguém com o nome do sócio.','No site, procure e-mails e WhatsApp.','Encontre o LinkedIn do dono.'].map((t,i)=>`<li class="flex gap-2.5 border-b border-line py-2 last:border-0"><span class="font-bold text-muted">${i+1}.</span>${t}</li>`).join('')}</ol>
      <p class="mt-3 border-t border-line pt-3 text-[13px] text-muted">Com isso você aborda por direct, ligação, WhatsApp, e-mail e, se for perto, visita presencial.</p>
    </section>
  </div>
  <h2 class="${H2} mt-7">Leads não abordados (${novos.length})</h2>
  <div class="overflow-x-auto rounded-2xl border border-line bg-surface"><table class="w-full min-w-[640px] border-collapse text-left text-sm">
    <thead><tr class="bg-surface2 text-xs font-bold text-muted">${['Empresa','Contato','E-mail','Telefone','CNPJ'].map(h=>`<th class="${td}">${h}</th>`).join('')}</tr></thead>
    <tbody>${novos.map(l=>`<tr class="last:[&>td]:border-0"><td class="${td}"><button class="text-left font-bold hover:underline" data-act="abrir" data-id="${l.id}">${esc(l.empresa)}</button></td><td class="${td}">${esc(l.contato)||'—'}</td><td class="${td}">${esc(l.email)||'—'}</td><td class="${td}">${esc(l.telefone)||'—'}</td><td class="${td}">${esc(l.cnpj)||'—'}</td></tr>`).join('') || `<tr><td colspan="5" class="px-3.5 py-3 text-[13px] text-muted">Nenhum lead novo. Importe uma lista acima.</td></tr>`}</tbody>
  </table></div>`;
}
const RENDER = {hoje:vHoje,funil:vFunil,lista:vLista,prospeccao:vProspeccao,agendamentos:vAgendamentos,followup:vFollowup,negociacao:vNegociacao,perdidos:vPerdidos};

/* ================= Estrutura da página ================= */
const initials = u => (u.displayName || u.email || '?').trim().split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase();
function renderShell(){
  $('#root').innerHTML = `
  <div class="md:grid md:min-h-screen md:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside class="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface px-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 md:sticky md:top-0 md:h-screen md:flex-col md:border-r md:border-t-0 md:px-2.5 md:py-5 lg:px-3.5">
      <div class="mb-5 hidden items-center gap-2.5 md:flex md:justify-center lg:justify-start lg:px-2.5">
        <div class="h-[26px] w-[26px] shrink-0 rounded-[7px] bg-gradient-to-br from-t1 via-t3 to-t6" aria-hidden="true"></div>
        <span class="hidden font-display text-xl font-bold tracking-tight lg:inline">Prospecção</span>
      </div>
      <nav id="nav" aria-label="Visões" class="no-scrollbar flex w-full overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible"></nav>
      <div id="account" class="mt-auto hidden md:block"></div>
    </aside>
    <main class="min-w-0 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))] md:px-6 md:pb-10 md:pt-6 lg:px-8 lg:pt-7">
      <div class="mb-3 flex items-center justify-between md:hidden">
        <div class="flex items-center gap-2"><div class="h-[22px] w-[22px] rounded-md bg-gradient-to-br from-t1 via-t3 to-t6" aria-hidden="true"></div><span class="font-display text-lg font-bold">Prospecção</span></div>
        <button data-act="conta" class="flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-xs font-bold" aria-label="Sua conta">${esc(initials(user))}</button>
      </div>
      <div id="main"></div>
    </main>
  </div>
  <button data-act="novo" aria-label="Novo lead" class="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-30 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-ink text-[26px] text-bg shadow-lg md:hidden">+</button>`;
}
function renderNav(){
  const badge = {
    prospeccao: leads.filter(l=>['leads','prospeccao'].includes(l.status)&&due(l)).length,
    followup: inStage('followup').filter(due).length,
    agendamentos: leads.filter(l=>['triagem','proposta'].includes(l.status)&&due(l)).length,
    negociacao: inStage('negociacao').filter(due).length
  };
  $('#nav').innerHTML = VIEWS.map(v=>`<button data-view="${v.id}" ${v.id===view?'aria-current="page"':''}
      class="relative flex min-w-[68px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-muted hover:bg-surface2 hover:text-ink aria-[current=page]:bg-surface2 aria-[current=page]:text-ink md:min-w-0 md:flex-row md:justify-center md:p-3 lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm"
      title="${v.nome}">
      <span class="${v.id===view?'text-t5':''}">${ICONS[v.id]}</span>
      <span class="whitespace-nowrap md:sr-only lg:not-sr-only">${v.nome}</span>
      ${badge[v.id]?`<span class="absolute right-2 top-0.5 h-2 w-2 rounded-full bg-t5 md:right-2 md:top-2 lg:static lg:ml-auto lg:h-auto lg:w-auto lg:rounded-full lg:bg-bg lg:px-2 lg:py-px lg:text-xs lg:font-bold lg:text-muted" aria-label="${badge[v.id]} para hoje"><span class="hidden lg:inline">${badge[v.id]}</span></span>`:''}
    </button>`).join('');
  $('#account').innerHTML = `<button data-act="conta" class="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-surface2 md:justify-center lg:justify-start" aria-label="Sua conta">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface2 text-xs font-bold">${esc(initials(user))}</span>
      <span class="hidden min-w-0 lg:block"><span class="block truncate text-sm font-bold">${esc(user.displayName || 'Sua conta')}</span><span class="block truncate text-xs text-muted">${esc(db.isDemo() ? 'Dados neste navegador' : user.email || '')}</span></span>
    </button>`;
}
let pendingRender = false;
function render(){
  if(!user) return;
  const a = document.activeElement;
  if(a && $('#main') && $('#main').contains(a) && ['INPUT','TEXTAREA','SELECT'].includes(a.tagName)){ pendingRender = true; return; }
  pendingRender = false;
  renderNav();
  $('#main').innerHTML = loaded ? (RENDER[view] || vHoje)() : '<div class="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-muted">Carregando seus leads…</div>';
}
document.addEventListener('focusout', ()=>{ if(pendingRender) setTimeout(()=>{ if(pendingRender) render(); }, 0); });

/* ================= Login ================= */
let authMode = 'entrar';
function renderLogin(msg=''){
  const demo = db.isDemo();
  const criar = authMode==='criar';
  $('#root').innerHTML = `<div class="flex min-h-screen items-center justify-center px-4 py-10">
    <div class="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-6 md:p-8">
      <div class="mb-6 flex items-center gap-2.5"><div class="h-[26px] w-[26px] rounded-[7px] bg-gradient-to-br from-t1 via-t3 to-t6" aria-hidden="true"></div><span class="font-display text-xl font-bold">Prospecção</span></div>
      <h1 class="font-display text-[28px] font-bold leading-tight tracking-tight">${criar?'Crie sua conta':'Entre no seu CRM'}</h1>
      <p class="mb-6 mt-1.5 text-sm text-muted">Seus leads ficam salvos na sua conta e sincronizados entre celular e computador.</p>
      ${demo ? `
        <div class="mb-4 rounded-xl bg-surface2 p-3.5 text-[13px] text-muted">O Firebase ainda não foi configurado. No modo demonstração, os dados ficam salvos só neste navegador.</div>
        ${btn('Entrar no modo demonstração',{act:'demo',variant:'primary',size:'lg'})}
      ` : `
        ${btn('Entrar com o Google',{act:'google',size:'lg'})}
        <div class="my-5 flex items-center gap-3 text-xs font-semibold text-muted"><span class="h-px flex-1 bg-line"></span>ou com e-mail<span class="h-px flex-1 bg-line"></span></div>
        <form id="authForm" class="flex flex-col gap-3" novalidate>
          ${criar ? field({name:'nome',label:'Seu nome',required:true,id:'a_nome'}) : ''}
          ${field({name:'email',label:'E-mail',type:'email',required:true,id:'a_email'})}
          ${field({name:'senha',label:'Senha',type:'password',required:true,id:'a_senha',placeholder:criar?'Mínimo de 6 caracteres':''})}
          ${btn(criar?'Criar conta':'Entrar',{type:'submit',variant:'primary',size:'lg'})}
        </form>
        <div class="mt-4 flex flex-wrap justify-between gap-2 text-sm">
          <button class="font-semibold text-muted underline hover:text-ink" data-act="authMode">${criar?'Já tenho conta':'Criar conta'}</button>
          ${criar?'':'<button class="font-semibold text-muted underline hover:text-ink" data-act="esqueci">Esqueci a senha</button>'}
        </div>
      `}
      <p id="authMsg" role="alert" class="${cx('mt-4 text-sm font-semibold', !msg && 'hidden', /enviado/i.test(msg)?'text-win':'text-t6')}">${esc(msg)}</p>
    </div>
  </div>`;
  const autocomplete = {a_email:'email', a_senha:criar?'new-password':'current-password', a_nome:'name'};
  Object.entries(autocomplete).forEach(([id,v])=>{ const el = document.getElementById(id); if(el) el.setAttribute('autocomplete', v); });
}
function authError(err){
  const m = db.authMessage(err);
  if(m){ const el = $('#authMsg'); el.textContent = m; el.className = 'mt-4 text-sm font-semibold text-t6'; }
}
function onAuth(u){
  if(unsubscribe){ unsubscribe(); unsubscribe = null; }
  closeDrawer(); closeSheet();
  user = u; leads = []; loaded = false;
  if(!u){ renderLogin(); return; }
  renderShell(); render();
  unsubscribe = db.subscribeLeads(list=>{
    leads = list; loaded = true;
    render();
    if(drawerId && !$('#drawer').contains(document.activeElement)) openDrawer(drawerId);
  }, err=>{ console.error(err); toast('Não foi possível carregar os leads. Verifique as regras do Firestore.'); loaded = true; render(); });
}

/* ================= Toast ================= */
let tt;
function toast(msg){
  const t = $('#toast'); t.textContent = msg;
  t.classList.remove('opacity-0','translate-y-3');
  clearTimeout(tt); tt = setTimeout(()=>t.classList.add('opacity-0','translate-y-3'), 2800);
}

/* ================= Janela de confirmação (sheet) ================= */
let sheetCb = null, lastFocus = null;
function openSheet({title,text,fields=[],confirm,onOk,body=''}){
  lastFocus = document.activeElement;
  $('#sheet').innerHTML = `<h3 id="sheetTitle" class="mb-1 font-display text-xl font-bold">${title}</h3>${text?`<p class="mb-3.5 text-sm text-muted">${text}</p>`:''}
    <form id="sheetForm"><div class="flex flex-col gap-3">${fields.map(f=>field({...f,id:'s_'+f.name})).join('')}${body}</div>
    <div class="mt-4 flex justify-end gap-2">${btn('Cancelar',{act:'close',variant:'ghost'})}${confirm?btn(confirm,{type:'submit',variant:'primary'}):''}</div></form>`;
  sheetCb = onOk || null;
  $('#sheet').classList.remove('hidden'); $('#scrim').classList.remove('hidden');
  const first = $('#sheet input, #sheet select'); (first || $('#sheet button')).focus();
}
function closeSheet(){
  if($('#sheet').classList.contains('hidden')) return;
  $('#sheet').classList.add('hidden'); sheetCb = null;
  if(!drawerId) $('#scrim').classList.add('hidden');
  lastFocus && lastFocus.focus && lastFocus.focus();
}

/* ================= Painel do lead (drawer) ================= */
let drawerId = null;
function openDrawer(id){
  const l = get(id); if(!l){ closeDrawer(); return; }
  drawerId = id;
  const f = (name,label,type='text',full=false) => field({name,label,type,value:l[name]??'',full});
  const sec = t => `<div class="col-span-full mt-2 border-t border-line pt-3 text-[13px] font-bold first:mt-0 first:border-0 first:pt-0">${t}</div>`;
  $('#drawer').innerHTML = `
    <div class="flex items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 class="truncate font-display text-[19px] font-bold">${esc(l.empresa)}</h2>${btn('Fechar',{act:'close',variant:'ghost',size:'sm'})}</div>
    <form id="leadForm" class="flex-1 overflow-y-auto px-5 py-4">
      <div class="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted"><span class="rounded-full px-2 py-px text-xs font-bold text-white" style="background:${STAGE[l.status].cor}">${STAGE[l.status].nome}</span>${metaFor(l)}</div>
      <div class="mb-5 flex flex-wrap gap-1.5">${actionsFor(l)}</div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        ${sec('Empresa e contato')}
        ${f('empresa','Nome da empresa','text',true)}${f('contato','Nome do contato')}${f('cnpj','CNPJ')}
        ${f('email','E-mail','email')}${f('telefone','Telefone / WhatsApp','tel')}
        ${f('instagram','Instagram')}${f('linkedin','LinkedIn do dono')}${f('site','Site','text',true)}
        ${sec('Processo')}
        ${field({name:'status',label:'Fase',value:l.status,options:STAGES.map(s=>({value:s.id,label:s.nome}))})}
        ${f('data','Próxima ação','date')}${f('hora','Horário','time')}${f('valor','Valor da proposta (R$)','number')}
        ${field({name:'motivo',label:'Motivo da perda',value:l.motivo||'',options:[{value:'',label:'—'}].concat(MOTIVOS.map(m=>m.id)),full:true})}
        ${f('notas','Anotações','textarea',true)}
      </div>
    </form>
    <div class="flex justify-between gap-2 border-t border-line px-5 py-3.5">${btn('Excluir',{act:'excluir',id:l.id,variant:'danger'})}${btn('Salvar alterações',{type:'submit',variant:'primary',attrs:'form="leadForm"'})}</div>`;
  $('#drawer').classList.remove('translate-x-full'); $('#scrim').classList.remove('hidden');
}
function closeDrawer(){
  drawerId = null;
  $('#drawer').classList.add('translate-x-full');
  if($('#sheet').classList.contains('hidden')) $('#scrim').classList.add('hidden');
}
function saveDrawer(form){
  const l = get(drawerId); if(!l) return;
  const d = Object.fromEntries(new FormData(form));
  if(!d.empresa.trim()){ toast('Informe o nome da empresa.'); return; }
  const prev = l.status;
  const n = {...l, ...d, valor:+d.valor||0};
  if(prev!==n.status){
    if(n.status==='perdido' && !n.motivo) n.motivo='Desistência';
    if(n.status==='followup' && !n.fup) n.fup=1;
    if(n.status==='prospeccao' && !n.tentativa) n.tentativa=1;
    if(n.status==='ganho') n.ganhoEm=today();
  }
  if(n.status!=='perdido') n.motivo='';
  persist(n); render(); toast('Alterações salvas.'); openDrawer(n.id);
}

/* ================= Ações ================= */
const ACTIONS = {
  abrir: l => openDrawer(l.id),
  tentativa: l => { registrarTentativa(l); commit(l); },
  fup: l => { registrarFup(l); commit(l); },
  triagem: l => openSheet({title:'Reunião de triagem',text:`Quando será a triagem com ${esc(l.empresa)}?`,confirm:'Agendar triagem',
    fields:[{name:'data',label:'Data',type:'date',value:addDays(1),required:true},{name:'hora',label:'Horário',type:'time',value:'10:00'}],
    onOk:d=>{Object.assign(l,{status:'triagem',data:d.data,hora:d.hora}); toast('Triagem agendada.'); commit(l);}}),
  proposta: l => openSheet({title:'Reunião de proposta',text:'O lead tem perfil. Marque a apresentação da proposta.',confirm:'Agendar proposta',
    fields:[{name:'data',label:'Data',type:'date',value:addDays(2),required:true},{name:'hora',label:'Horário',type:'time',value:l.hora||'10:00'},{name:'valor',label:'Valor estimado (R$)',type:'number',value:l.valor||''}],
    onOk:d=>{Object.assign(l,{status:'proposta',data:d.data,hora:d.hora,valor:+d.valor||0}); toast('Proposta agendada.'); commit(l);}}),
  irFup: l => openSheet({title:'Mover para follow-up',text:'Atualize a proposta e defina quando cobrar a resposta.',confirm:'Mover para follow-up',
    fields:[{name:'valor',label:'Valor da proposta (R$)',type:'number',value:l.valor||''},{name:'data',label:'Data do follow-up',type:'date',value:addDays(2),required:true}],
    onOk:d=>{Object.assign(l,{status:'followup',fup:1,data:d.data,hora:'',valor:+d.valor||0}); toast('Em follow-up: FUP 1.'); commit(l);}}),
  negociar: l => openSheet({title:'Em negociação',text:'Falta só o contrato ou o pagamento. Quando você volta a falar com ele?',confirm:'Mover para negociação',
    fields:[{name:'valor',label:'Valor do contrato (R$)',type:'number',value:l.valor||''},{name:'data',label:'Próximo contato',type:'date',value:addDays(1),required:true}],
    onOk:d=>{Object.assign(l,{status:'negociacao',data:d.data,hora:'',valor:+d.valor||0}); toast('Movido para negociação.'); commit(l);}}),
  reagendar: l => openSheet({title:'Reagendar contato',text:'Use a data que o cliente combinou.',confirm:'Reagendar',
    fields:[{name:'data',label:'Data',type:'date',value:addDays(1),required:true}],
    onOk:d=>{l.data=d.data; toast(`Reagendado para ${fmtDate(d.data).toLowerCase()}.`); commit(l);}}),
  ganhar: l => { Object.assign(l,{status:'ganho',ganhoEm:today(),data:''}); toast(`${l.empresa} fechado. Hora do onboarding.`); commit(l); },
  perder: l => openSheet({title:'Registrar perda',text:'O motivo alimenta a análise de gargalos.',confirm:'Marcar como perdido',
    fields:[{name:'motivo',label:'Motivo',options:MOTIVOS.map(m=>m.id),value:l.status==='triagem'?'Sem perfil':['prospeccao','leads'].includes(l.status)?'Sem contato':'Financeiro'}],
    onOk:d=>{Object.assign(l,{status:'perdido',motivo:d.motivo,data:''}); toast('Lead marcado como perdido.'); commit(l);}}),
  reativar: l => { Object.assign(l,{status:'prospeccao',motivo:'',tentativa:1,fup:0,data:today()}); toast(`${l.empresa} reativado na Tentativa 1.`); commit(l); },
  excluir: l => openSheet({title:'Excluir lead?',text:`${esc(l.empresa)} será removido de vez, sem como desfazer.`,confirm:'Excluir lead',
    onOk:()=>{ leads = leads.filter(x=>x.id!==l.id); db.deleteLead(l.id).catch(fail); closeDrawer(); render(); toast('Lead excluído.'); }})
};
function novo(){
  openSheet({title:'Novo lead',confirm:'Adicionar lead',
    fields:[{name:'empresa',label:'Nome da empresa',required:true},{name:'contato',label:'Nome do contato'},{name:'telefone',label:'Telefone',type:'tel'},{name:'email',label:'E-mail',type:'email'}],
    onOk:d=>{
      if(!d.empresa.trim()){ toast('Informe o nome da empresa.'); return false; }
      persist(novoLead({empresa:d.empresa.trim(),contato:d.contato.trim(),telefone:d.telefone.trim(),email:d.email.trim()}));
      render(); toast('Lead adicionado como não abordado.');
    }});
}
function importar(){
  const txt = ($('#importBox')?.value || '').trim();
  if(!txt){ toast('Cole as linhas da planilha antes de importar.'); return; }
  const novos = [];
  txt.split(/\r?\n/).forEach(line=>{
    const c = line.split(line.includes('\t')?'\t':/[;,]/).map(s=>s.trim());
    if(!c[0] || /^(empresa|nome da empresa)$/i.test(c[0])) return;
    novos.push(novoLead({empresa:c[0],contato:c[1]||'',email:c[2]||'',telefone:c[3]||''}));
  });
  if(!novos.length){ toast('Nenhuma linha válida encontrada.'); return; }
  $('#importBox').value = '';
  leads = leads.concat(novos);
  db.saveMany(novos).catch(fail);
  render(); toast(`${novos.length} leads importados como não abordados.`);
}
function sample(){
  const L = (empresa,contato,status,extra={}) => novoLead({empresa,contato,status,...extra});
  return [
    L('Padaria Ponto Doce','Marta Ribeiro','leads'),
    L('Clínica Sorriso Pleno','Dr. Caio Mendes','leads'),
    L('Auto Center Rota 116','Rogério Lima','leads'),
    L('Studio Bela Forma','Camila Duarte','prospeccao',{tentativa:1}),
    L('Ótica Visão Clara','Paulo Nunes','prospeccao',{tentativa:2}),
    L('Pet Shop Quatro Patas','Juliana Prado','prospeccao',{tentativa:3,data:addDays(1)}),
    L('Construtora Alicerce','Fernando Alves','prospeccao',{tentativa:4}),
    L('Escola de Idiomas Fluent','Renata Costa','prospeccao',{tentativa:5}),
    L('Móveis Casa Nobre','Sérgio Tavares','triagem',{hora:'15:00'}),
    L('Hamburgueria Brasa','Diego Moura','proposta',{data:addDays(2),hora:'10:30',valor:2000}),
    L('Academia Força Total','André Souza','followup',{fup:2,valor:2500}),
    L('Imobiliária Porto Seguro','Luciana Faria','negociacao',{data:addDays(1),valor:3000,notas:'Jurídico libera o contrato na terça.'}),
    L('Loja Verde Vida','Tatiane Rocha','ganho',{valor:3000,ganhoEm:today(),data:''}),
    L('Distribuidora Norte Sul','Marcos Pinto','perdido',{motivo:'Sem contato',tentativa:5,data:''}),
    L('Salão Glamour','Beatriz Lopes','perdido',{motivo:'Concorrência',valor:1800,data:''})
  ];
}
function conta(){
  openSheet({title:esc(user.displayName || 'Sua conta'),
    text: db.isDemo() ? 'Modo demonstração: os dados ficam salvos só neste navegador.' : esc(user.email || ''),
    body:`<div class="flex flex-col gap-2">${leads.length?'':btn('Carregar leads de exemplo',{act:'exemplos'})}${btn('Sair da conta',{act:'sair',variant:'danger'})}</div>`});
}

/* ================= Eventos ================= */
document.addEventListener('submit', async e=>{
  const f = e.target;
  if(f.id==='sheetForm'){
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    const cb = sheetCb;
    if(cb && cb(data)===false) return;
    closeSheet();
  } else if(f.id==='leadForm'){
    e.preventDefault(); saveDrawer(f);
  } else if(f.id==='authForm'){
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const submit = f.querySelector('[type=submit]');
    if(!d.email || !d.senha){ authError({code:!d.email?'auth/invalid-email':'auth/missing-password'}); return; }
    submit.disabled = true;
    try{
      if(authMode==='criar') await db.signupEmail(d.nome||'', d.email, d.senha);
      else await db.loginEmail(d.email, d.senha);
    }catch(err){ authError(err); submit.disabled = false; }
  }
});
document.addEventListener('click', async e=>{
  const v = e.target.closest('[data-view]');
  if(v){ setView(v.dataset.view); closeDrawer(); closeSheet(); render(); window.scrollTo(0,0); return; }
  const a = e.target.closest('[data-act]'); if(!a) return;
  const act = a.dataset.act;
  switch(act){
    case 'close': if(!$('#sheet').classList.contains('hidden')) closeSheet(); else closeDrawer(); return;
    case 'novo': return novo();
    case 'importar': return importar();
    case 'conta': return conta();
    case 'exemplos': { const s = sample(); leads = leads.concat(s); db.saveMany(s).catch(fail); closeSheet(); setView('hoje'); render(); toast('Leads de exemplo carregados.'); return; }
    case 'sair': closeSheet(); return db.logout(onAuth).catch(()=>toast('Não foi possível sair. Tente de novo.'));
    case 'demo': return db.loginDemo(onAuth);
    case 'google': try{ await db.loginGoogle(); }catch(err){ authError(err); } return;
    case 'authMode': authMode = authMode==='criar' ? 'entrar' : 'criar'; return renderLogin();
    case 'esqueci': {
      const email = $('#a_email')?.value.trim();
      if(!email){ authError({code:'auth/invalid-email'}); $('#a_email').focus(); return; }
      try{ await db.resetPassword(email); renderLogin('Enviamos um link para redefinir a senha. Confira seu e-mail.'); $('#a_email').value = email; }
      catch(err){ authError(err); }
      return;
    }
  }
  const l = get(a.dataset.id);
  if(l && ACTIONS[act]) ACTIONS[act](l);
});
$('#scrim').addEventListener('click', ()=>{ if(!$('#sheet').classList.contains('hidden')) closeSheet(); else closeDrawer(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ if(!$('#sheet').classList.contains('hidden')) closeSheet(); else if(drawerId) closeDrawer(); }});

/* ================= Início ================= */
db.init(onAuth).catch(err=>{
  console.error(err);
  $('#root').innerHTML = '<div class="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted">Não foi possível iniciar o app. Verifique a conexão e a configuração do Firebase.</div>';
});
