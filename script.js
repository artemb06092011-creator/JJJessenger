import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { 
  getFirestore, 
  doc, getDoc, setDoc, updateDoc, 
  collection, query, where, getDocs,
  serverTimestamp
} from "firebase/firestore";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBI7VB0zTARMTKEj1tVr_VwzfoQ6bJw0x0",
  authDomain: "jmessenger-519cf.firebaseapp.com",
  projectId: "jmessenger-519cf",
  storageBucket: "jmessenger-519cf.firebasestorage.app",
  messagingSenderId: "339570238049",
  appId: "1:339570238049:web:01d8a317f99314ddefc020",
  measurementId: "G-YPYR4B4HCV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let currentUserData = null;
let theme = 'dark';
const appEl = document.getElementById('app');

function render(html) {
  appEl.innerHTML = html;
}

function showAuthScreen() {
  render(`
    <div class="flex-center" style="padding: 20px 0;">
      <h1 style="font-size: 38px; font-weight: 800; background: linear-gradient(135deg,#f0935e,#e87a4b); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">
        J Messenger
      </h1>
      <p style="color: #a0a0b0; margin: 6px 0 30px;">Соединяя людей мгновенно</p>
      <p style="color: #b0b0bc; text-align: center; font-size: 14px; max-width: 280px;">
        Для входа или регистрации подтвердите свою электронную почту.
      </p>
      <p style="color: #7a7a88; font-size: 13px; margin-top: 6px;">
        Если письмо не пришло, проверьте папку "Спам".
      </p>
      <input id="emailInput" class="input-field" type="email" placeholder="Email" value="">
      <button id="sendLinkBtn" class="btn-primary" style="margin-top: 12px;">Продолжить</button>
      <div id="authMessage" style="margin-top: 16px; color: #ff6b6b; font-size: 14px;"></div>
    </div>
  `);
  
  document.getElementById('sendLinkBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value.trim();
    if (!email) return alert('Введите email');
    try {
      const actionCodeSettings = { 
        url: window.location.href, 
        handleCodeInApp: true 
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      localStorage.setItem('emailForSignIn', email);
      showEmailSentScreen(email);
    } catch(e) {
      document.getElementById('authMessage').textContent = 'Ошибка: ' + e.message;
    }
  });
}

function showEmailSentScreen(email) {
  render(`
    <div class="flex-center" style="padding: 40px 0;">
      <span style="font-size: 72px;">📨</span>
      <h2 style="margin: 20px 0 10px;">Письмо отправлено</h2>
      <p style="text-align:center; color:#b0b0bc;">
        Мы отправили ссылку на <strong>${email}</strong>
      </p>
      <p style="text-align:center; color:#8e8e9a; margin-top: 10px;">
        Откройте письмо и перейдите по ссылке.<br>
        После подтверждения вход произойдёт автоматически.
      </p>
    </div>
  `);
}

function showProfileSetup() {
  render(`
    <div class="flex-center" style="padding: 8px 0;">
      <h2 style="margin-bottom: 16px;">Создание профиля</h2>
      <input id="profileName" class="input-field" placeholder="Имя" value="">
      <input id="profileUsername" class="input-field" placeholder="Username" value="">
      <div id="usernameCheck" class="username-check">Username должен быть уникальным.</div>
      <button id="createProfileBtn" class="btn-primary" style="margin-top: 8px;">Создать профиль</button>
      <div id="profileError" style="color:#ff6b6b; margin-top: 12px;"></div>
    </div>
  `);
  
  const usernameInput = document.getElementById('profileUsername');
  const checkDiv = document.getElementById('usernameCheck');
  let usernameAvailable = false;
  
  usernameInput.addEventListener('input', async () => {
    const val = usernameInput.value.trim();
    if (val.length < 3) {
      checkDiv.innerHTML = 'Username должен быть уникальным.';
      return;
    }
    try {
      const q = query(collection(db, 'users'), where('username', '==', val));
      const snap = await getDocs(q);
      const taken = !snap.empty;
      if (taken) {
        checkDiv.innerHTML = '🔴 Username уже занят';
        usernameAvailable = false;
      } else {
        checkDiv.innerHTML = '🟢 Username свободен';
        usernameAvailable = true;
      }
    } catch(e) {
      checkDiv.innerHTML = 'Ошибка проверки';
    }
  });
  
  document.getElementById('createProfileBtn').addEventListener('click', async () => {
    const name = document.getElementById('profileName').value.trim();
    const username = document.getElementById('profileUsername').value.trim();
    if (!name || !username) return alert('Заполните все поля');
    if (!usernameAvailable) return alert('Username занят или не проверен');
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        name,
        username,
        photo: '',
        createdAt: serverTimestamp()
      });
      currentUserData = { name, username, photo: '' };
      showMainScreen();
    } catch(e) {
      document.getElementById('profileError').textContent = 'Ошибка: ' + e.message;
    }
  });
}

function showMainScreen() {
  render(`
    <div>
      <div class="header">
        <h1>J Messenger</h1>
        <button id="addGroupBtn" class="round-btn">+</button>
      </div>
      <div class="search-box">
        <span>🔍</span>
        <input id="globalSearch" placeholder="Поиск пользователей..." />
      </div>
      <div id="chatList">
        <div class="empty-state">
          <span>😔</span>
          <p>Пока тут никого нет</p>
          <p style="font-size:14px;">Найдите кого-то, чтобы начать общение 💬</p>
        </div>
      </div>
      <div class="footer-nav">
        <div class="nav-item active" id="navChats">💬 Чаты</div>
        <div class="nav-item" id="navSettings">⚙️ Настройки</div>
      </div>
    </div>
  `);
  
  document.getElementById('globalSearch').addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) {
      document.getElementById('chatList').innerHTML = 
        `<div class="empty-state"><span>😔</span><p>Введите минимум 2 символа</p></div>`;
      return;
    }
    try {
      const usersRef = collection(db, 'users');
      const qSnap = await getDocs(query(usersRef, where('username', '>=', q), where('username', '<=', q + '\uf8ff')));
      let html = '';
      qSnap.forEach(doc => {
        const data = doc.data();
        if (data.uid === currentUser.uid) return;
        html += `
          <div class="user-item" data-uid="${data.uid}">
            <span class="avatar" style="background:#3a3a44;">${data.name?.[0]||'U'}</span>
            <div>
              <strong>${data.name}</strong> 
              <span style="color:#8e8e9a;">@${data.username}</span>
            </div>
          </div>
        `;
      });
      document.getElementById('chatList').innerHTML = html || 
        '<div class="empty-state">Никого не найдено</div>';
      
      document.querySelectorAll('.user-item').forEach(el => {
        el.addEventListener('click', () => {
          alert('Чат с пользователем (демо)');
        });
      });
    } catch(e) {
      console.error(e);
    }
  });
  
  document.getElementById('navSettings').addEventListener('click', showSettingsScreen);
  document.getElementById('addGroupBtn').addEventListener('click', showCreateGroupModal);
}

function showSettingsScreen() {
  render(`
    <div>
      <div class="header">
        <h1>Настройки</h1>
        <button class="round-btn" id="backFromSettings" style="background:#3a3a44; font-size:20px;">←</button>
      </div>
      <div class="settings-card" style="display:flex; gap:16px; align-items:center;">
        <img id="profilePhotoPreview" src="${currentUserData?.photo || ''}" class="avatar-large" style="width:64px;height:64px;" />
        <div>
          <strong>${currentUserData?.name}</strong><br>
          <span style="color:#8e8e9a;">@${currentUserData?.username}</span>
        </div>
      </div>
      <div class="settings-card">
        <button id="changePhotoBtn" class="btn-secondary" style="width:100%; margin:6px 0;">Изменить фото</button>
        <button id="changeNameBtn" class="btn-secondary" style="width:100%; margin:6px 0;">Изменить имя</button>
      </div>
      <div class="settings-card">
        <div class="theme-toggle">
          <span>🌙 Тёмная тема / ☀️ Светлая</span>
          <div id="themeSwitch" class="theme-switch"><div class="thumb"></div></div>
        </div>
      </div>
      <button id="logoutBtn" class="btn-secondary" style="width:100%; margin-top:16px; color:#ff6b6b;">Выйти из аккаунта</button>
    </div>
  `);
  
  document.getElementById('backFromSettings').addEventListener('click', showMainScreen);
  
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await signOut(auth);
    currentUser = null;
    currentUserData = null;
    showAuthScreen();
  });
  
  const themeSwitch = document.getElementById('themeSwitch');
  themeSwitch.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'theme-animation-overlay';
    const icon = document.createElement('div');
    icon.className = 'theme-icon-anim';
    overlay.appendChild(icon);
    document.body.appendChild(overlay);
    
    setTimeout(() => icon.classList.add('active'), 40);
    setTimeout(() => {
      const isLight = document.body.classList.toggle('light');
      theme = isLight ? 'light' : 'dark';
      icon.classList.remove('active');
      setTimeout(() => overlay.remove(), 400);
    }, 500);
  });
  
  document.getElementById('changePhotoBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const ref = ref(storage, `profiles/${currentUser.uid}`);
        await uploadBytes(ref, file);
        const url = await getDownloadURL(ref);
        await updateDoc(doc(db, 'users', currentUser.uid), { photo: url });
        currentUserData.photo = url;
        document.getElementById('profilePhotoPreview').src = url;
      } catch(err) {
        alert('Ошибка загрузки');
      }
    };
    input.click();
  });
  
  document.getElementById('changeNameBtn').addEventListener('click', () => {
    const newName = prompt('Новое имя:', currentUserData?.name || '');
    if (newName && newName.trim()) {
      updateDoc(doc(db, 'users', currentUser.uid), { name: newName.trim() });
      currentUserData.name = newName.trim();
      showSettingsScreen();
    }
  });
}

function showCreateGroupModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3 style="margin-bottom:12px;">Создать группу</h3>
      <input id="groupName" class="input-field" placeholder="Название группы" />
      <button id="createGroupFinal" class="btn-primary" style="margin-top:8px;">🔒 Личная группа</button>
      <button class="btn-secondary" style="margin-top:8px;" id="closeGroupModal">Отмена</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  document.getElementById('closeGroupModal').addEventListener('click', () => overlay.remove());
  
  document.getElementById('createGroupFinal').addEventListener('click', async () => {
    const name = document.getElementById('groupName').value.trim();
    if (!name) return alert('Введите название');
    try {
      const groupRef = doc(collection(db, 'groups'));
      await setDoc(groupRef, {
        name,
        photo: '',
        owner: currentUser.uid,
        members: [currentUser.uid],
        createdAt: serverTimestamp()
      });
      overlay.remove();
      alert('Группа создана!');
      showMainScreen();
    } catch(e) {
      alert('Ошибка: ' + e.message);
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const docSnap = await getDoc(doc(db, 'users', user.uid));
    if (docSnap.exists()) {
      currentUserData = docSnap.data();
      showMainScreen();
    } else {
      showProfileSetup();
    }
  } else {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = localStorage.getItem('emailForSignIn');
      if (!email) email = prompt('Введите email для входа');
      try {
        await signInWithEmailLink(auth, email, window.location.href);
        localStorage.removeItem('emailForSignIn');
        window.location.href = window.location.href.split('?')[0];
      } catch(e) {
        alert('Ошибка входа: ' + e.message);
      }
    } else {
      showAuthScreen();
    }
  }
});

document.body.classList.remove('light');
theme = 'dark';