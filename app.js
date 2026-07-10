import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    where,
    and,
    or,
    Timestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ========== ПЕРЕМЕННЫЕ ==========
let currentUser = null;
let otherUser = null;
let unsubscribe = null;
let allUsers = [];

// ========== DOM ЭЛЕМЕНТЫ ==========
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messagesContainer');
const chatTitle = document.getElementById('chatTitle');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');
const usernameInput = document.getElementById('username');

// ========== СОБЫТИЯ ==========
loginForm.addEventListener('submit', handleLogin);
messageForm.addEventListener('submit', handleSendMessage);
logoutBtn.addEventListener('click', handleLogout);

// ========== ВХОД ==========
async function handleLogin(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim().toLowerCase();

    // Валидация
    if (!username) {
        showLoginError('Введите ник');
        return;
    }

    if (username.length < 2) {
        showLoginError('Ник должен быть минимум 2 символа');
        return;
    }

    if (username.length > 20) {
        showLoginError('Ник не может быть более 20 символов');
        return;
    }

    if (!/^[a-zA-Z0-9_а-яё]+$/.test(username)) {
        showLoginError('Ник может содержать только буквы, цифры и _');
        return;
    }

    try {
        // Получить список всех активных пользователей
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        allUsers = snapshot.docs.map(d => d.data().username);

        // Проверить есть ли другой пользователь
        const otherUsers = allUsers.filter(u => u !== username);

        if (otherUsers.length === 0) {
            showLoginError('Ждем второго участника...');
            return;
        }

        otherUser = otherUsers[0];
        currentUser = username;

        // Добавить пользователя в БД
        await addDoc(usersRef, {
            username: currentUser,
            timestamp: Timestamp.now()
        });

        // Очистить форму
        loginForm.reset();
        loginError.textContent = '';
        
        // Переключить экран
        loginScreen.classList.remove('active');
        chatScreen.classList.add('active');
        
        // Установить заголовок
        chatTitle.textContent = otherUser;
        
        // Загрузить сообщения
        loadMessages();
        
        // Фокус на input
        setTimeout(() => messageInput.focus(), 300);

    } catch (error) {
        console.error('Ошибка входа:', error);
        showLoginError('Ошибка подключения');
    }
}

function showLoginError(message) {
    loginError.textContent = message;
    setTimeout(() => {
        if (currentUser === null) {
            loginError.textContent = '';
        }
    }, 3000);
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages() {
    const messagesRef = collection(db, 'messages');
    const q = query(
        messagesRef,
        or(
            and(
                where('from', '==', currentUser),
                where('to', '==', otherUser)
            ),
            and(
                where('from', '==', otherUser),
                where('to', '==', currentUser)
            )
        ),
        orderBy('timestamp', 'asc')
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        displayMessages(snapshot.docs);
        
        // Скролл вниз к последнему сообщению
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }, (error) => {
        console.error('Ошибка загрузки сообщений:', error);
    });
}

function displayMessages(docs) {
    messagesContainer.innerHTML = '';
    
    if (docs.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.textContent = 'Начните диалог!';
        emptyMessage.style.cssText = 'text-align: center; color: #999; padding: 20px; margin: auto;';
        messagesContainer.appendChild(emptyMessage);
        return;
    }

    docs.forEach(doc => {
        const data = doc.data();
        const messageEl = createMessageElement(data);
        messagesContainer.appendChild(messageEl);
    });
}

function createMessageElement(data) {
    const div = document.createElement('div');
    const isOwn = data.from === currentUser;
    
    div.className = `message ${isOwn ? 'own' : ''}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = data.text;
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(data.timestamp);
    
    div.appendChild(bubble);
    div.appendChild(time);
    
    return div;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else {
        date = new Date();
    }
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
}

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
async function handleSendMessage(e) {
    e.preventDefault();
    
    const text = messageInput.value.trim();
    
    if (!text) return;
    
    try {
        messageInput.disabled = true;
        
        await addDoc(collection(db, 'messages'), {
            from: currentUser,
            to: otherUser,
            text: text,
            timestamp: Timestamp.now()
        });
        
        messageInput.value = '';
        messageInput.disabled = false;
        messageInput.focus();
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        messageInput.disabled = false;
    }
}

// ========== ВЫХОД ==========
function handleLogout() {
    if (unsubscribe) {
        unsubscribe();
    }
    
    currentUser = null;
    otherUser = null;
    messagesContainer.innerHTML = '';
    
    chatScreen.classList.remove('active');
    loginScreen.classList.add('active');
    
    messageInput.value = '';
    usernameInput.value = '';
    usernameInput.focus();
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
window.addEventListener('load', () => {
    usernameInput.focus();
});
