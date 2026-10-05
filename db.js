/* =====================================================================
   Login e banco de dados.

   Firebase Authentication: Google ou e-mail e senha.
   Firestore:
     users/{uid}              perfil (nome, e-mail, último acesso)
     users/{uid}/leads/{id}   leads do CRM
   Cada usuário só acessa os próprios dados (ver firestore.rules).

   Sem configuração do Firebase, entra em modo demonstração:
   os dados ficam só no navegador (localStorage).
   ===================================================================== */
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const DEMO_KEY = 'crm-prospeccao:demo';
const DEMO_USER = { uid: 'demo', displayName: 'Modo demonstração', email: '' };

let demo = true;
let A, F;              // módulos do Firebase Auth e Firestore
let auth, fs;          // instâncias
let current = null;    // usuário logado
let demoState = { signedIn: false, leads: [] };
let demoListener = null;

const demoLoad = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || null; } catch (e) { return null; } };
const demoSave = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoState)); } catch (e) {} };
const demoEmit = () => demoListener && demoListener(demoState.leads.map(l => ({ ...l })));
const clean = obj => JSON.parse(JSON.stringify(obj));

export const isDemo = () => demo;
export const currentUser = () => current;

/* Carrega a configuração e avisa quando o usuário entra ou sai. */
export async function init(onAuth) {
  let cfg = FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) {
    try {
      const r = await fetch('/__/firebase/init.json', { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) cfg = await r.json();
    } catch (e) {}
  }

  if (!cfg || !cfg.apiKey) {
    demo = true;
    demoState = { signedIn: false, leads: [], ...(demoLoad() || {}) };
    current = demoState.signedIn ? DEMO_USER : null;
    onAuth(current);
    return;
  }

  demo = false;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
  ]);
  A = authMod; F = fsMod;
  const app = appMod.initializeApp(cfg);
  auth = A.getAuth(app);
  auth.languageCode = 'pt';
  try {
    fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    fs = F.getFirestore(app);
  }
  A.getRedirectResult(auth).catch(() => {});
  A.onAuthStateChanged(auth, u => {
    current = u;
    if (u) {
      F.setDoc(F.doc(fs, 'users', u.uid), {
        nome: u.displayName || '', email: u.email || '', ultimoAcesso: F.serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
    onAuth(u);
  });
}

/* ---------------- Login ---------------- */
export async function loginGoogle() {
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await A.signInWithPopup(auth, provider);
  } catch (err) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(err.code)) {
      return A.signInWithRedirect(auth, provider);
    }
    throw err;
  }
}
export const loginEmail = (email, senha) => A.signInWithEmailAndPassword(auth, email.trim(), senha);
export async function signupEmail(nome, email, senha) {
  const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), senha);
  if (nome) {
    await A.updateProfile(cred.user, { displayName: nome.trim() });
    await F.setDoc(F.doc(fs, 'users', cred.user.uid), { nome: nome.trim() }, { merge: true }).catch(() => {});
  }
  return cred;
}
export const resetPassword = email => A.sendPasswordResetEmail(auth, email.trim());

export function loginDemo(onAuth) {
  demoState.signedIn = true; demoSave();
  current = DEMO_USER; onAuth(current);
}
export async function logout(onAuth) {
  if (demo) { demoState.signedIn = false; demoSave(); current = null; onAuth(null); return; }
  await A.signOut(auth);
}

/* Traduz os erros do Firebase para mensagens claras. null = não mostrar nada. */
export function authMessage(err) {
  const map = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Entre ou recupere a senha.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/missing-password': 'Digite a senha.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente de novo.',
    'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase. Adicione-o em Authentication > Configurações > Domínios autorizados.',
    'auth/operation-not-allowed': 'Esse método de login não está ativado no Firebase.',
    'auth/popup-closed-by-user': null,
    'auth/cancelled-popup-request': null
  };
  return err && err.code in map ? map[err.code] : 'Não foi possível entrar. Tente de novo.';
}

/* ---------------- Leads ---------------- */
const leadsCol = () => F.collection(fs, 'users', current.uid, 'leads');
const leadDoc = id => F.doc(fs, 'users', current.uid, 'leads', id);

/* Escuta os leads em tempo real. Devolve a função para parar de escutar. */
export function subscribeLeads(onData, onError) {
  if (demo) {
    demoListener = onData;
    setTimeout(demoEmit, 0);
    return () => { demoListener = null; };
  }
  return F.onSnapshot(leadsCol(),
    snap => onData(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
    err => onError && onError(err));
}

export async function saveLead(lead) {
  const { id, ...data } = clean(lead);
  if (demo) {
    const i = demoState.leads.findIndex(l => l.id === id);
    if (i < 0) demoState.leads.push({ ...data, id }); else demoState.leads[i] = { ...data, id };
    demoSave(); demoEmit(); return;
  }
  delete data.atualizadoEm;
  await F.setDoc(leadDoc(id), { ...data, atualizadoEm: F.serverTimestamp() });
}

export async function saveMany(list) {
  if (demo) {
    list.forEach(l => {
      const c = clean(l);
      const i = demoState.leads.findIndex(x => x.id === c.id);
      if (i < 0) demoState.leads.push(c); else demoState.leads[i] = c;
    });
    demoSave(); demoEmit(); return;
  }
  for (let i = 0; i < list.length; i += 450) {
    const batch = F.writeBatch(fs);
    list.slice(i, i + 450).forEach(l => {
      const { id, ...data } = clean(l);
      delete data.atualizadoEm;
      batch.set(leadDoc(id), { ...data, atualizadoEm: F.serverTimestamp() });
    });
    await batch.commit();
  }
}

export async function deleteLead(id) {
  if (demo) {
    demoState.leads = demoState.leads.filter(l => l.id !== id);
    demoSave(); demoEmit(); return;
  }
  await F.deleteDoc(leadDoc(id));
}
