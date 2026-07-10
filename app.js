import { db, auth } from './firebase-config.js';
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
    getDocs,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ========== ПЕРЕМЕННЫЕ ==========
const ALLOWED_USERS = ['user1', 'user2']; // Пользователи чата
const CHAT_PASSWORD = 'password123'; // Пароль для входа

let currentUser = null;
let otherUser = null;
let unsubscribe = null;

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

// ========== СОБЫТИЯ ==========
loginForm.addEventListener('submit', handleLogin);
messageForm.addEventListener('submit', handleSendMessage);
logoutBtn.addEventListener('click', handleLogout);

// Предотвращение автозаполнения
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('blur', () => {
        if (input.value) {
            input.type = input.id === 'password' ? 'password' : 'text';
        }
    });
});

// ========== ВХОД ==========
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Валидация
    if (!username || !password) {
        showLoginError('Заполните оба поля');
        return;
    }

    if (!ALLOWED_USERS.includes(username)) {
        showLoginError('Неверные учетные данные');
        return;
    }

    if (password !== CHAT_PASSWORD) {
        showLoginError('Неверный пароль');
        return;
    }

    // Успешный вход
    currentUser = username;
    otherUser = ALLOWED_USERS.find(u => u !== currentUser);
    
    // Очистить форму
    loginForm.reset();
    loginError.textContent = '';
    
    // Переключить экран
    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');
    
    // Установить заголовок
    chatTitle.textContent = `Чат с ${otherUser}`;
    
    // Загрузить сообщения
    loadMessages();
    
    // Фокус на input
    setTimeout(() => messageInput.focus(), 300);
}

function showLoginError(message) {
    loginError.textContent = message;
    setTimeout(() => {
        loginError.textContent = '';
    }, 3000);
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages() {
    // Создать запрос для получения сообщений между двумя пользователями
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

    // Подписаться на реальные обновления
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
        emptyMessage.textContent = 'Нет сообщений. Начните диалог!';
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
    if (timestamp instanceof Timestamp) {
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
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('username').focus();
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
window.addEventListener('load', () => {
    document.getElementById('username').focus();
});
