import { 
    appState, 
    db, 
    USERS_COLLECTION_ROOT, 
    pushLog, 
    setActiveTab 
} from './kpi-core-v08.js';

import { toggleViewToApp, toggleViewToLogin } from './ui.js';

import { 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// --- 1. SEED DEFAULT USERS ---
async function seedUsers() {
    if (!db) return;
    
    const defaultUsers = [
        { username: 'admin', password: 'admin230049', role: 'Admin', displayName: 'Administrator' },
        { username: '4340', password: 'SGM4340**', role: 'Store Manager', displayName: 'Manager 4340' }, 
        { username: '4340s', password: '4340s', role: 'Store', displayName: 'Staff 4340' }
    ];

    try {
        for (const user of defaultUsers) {
            const userRef = doc(db, USERS_COLLECTION_ROOT, user.username);
            const snap = await getDoc(userRef);
            
            if (!snap.exists()) {
                await setDoc(userRef, user);
                console.log(`[SEED] Created user: ${user.username}`);
            }
        }
    } catch (error) {
        console.error("[SEED ERROR]", error);
    }
}

// --- 3. LOGIN HANDLER ---
async function handleLoginSubmit(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById("loginName");
    const passInput = document.getElementById("loginPassword");
    const btnSubmit = event.target.querySelector("button[type='submit']");

    const username = (nameInput?.value || "").trim();
    const password = (passInput?.value || "").trim();

    if (!username || !password) {
        Swal.fire('Login Error', 'กรุณากรอก Username และ Password', 'warning');
        return;
    }

    if (!appState.firebaseReady || !db) {
        Swal.fire('System Error', 'ยังไม่ได้เชื่อมต่อ Database กรุณารอสักครู่', 'error');
        return;
    }

    try {
        if(btnSubmit) {
            btnSubmit.innerHTML = 'Checking...';
            btnSubmit.disabled = true;
        }

        const userRef = doc(db, USERS_COLLECTION_ROOT, username);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            throw new Error("ไม่พบผู้ใช้งานนี้ในระบบ");
        }

        const userData = userSnap.data();

        if (userData.password !== password) {
            throw new Error("รหัสผ่านไม่ถูกต้อง");
        }

        // Login Success
        appState.username = userData.username;
        appState.displayName = userData.displayName || userData.username;
        appState.role = userData.role;

        pushLog(`[LOGIN] Success: ${appState.username} (${appState.role})`);
        
        if (passInput) passInput.value = ""; // Clear password
        
        // SWITCH VIEW
        toggleViewToApp();

    } catch (error) {
        console.error(error);
        pushLog(`[LOGIN FAILED] ${error.message}`);
        Swal.fire('เข้าสู่ระบบไม่สำเร็จ', error.message, 'error');
    } finally {
        if(btnSubmit) {
            btnSubmit.innerHTML = 'เข้าสู่ระบบ';
            btnSubmit.disabled = false;
        }
    }
}

function handleLogout() {
    appState.displayName = null;
    appState.username = null;
    appState.role = null;
    
    const nameInput = document.getElementById("loginName");
    const passInput = document.getElementById("loginPassword");
    if (nameInput) nameInput.value = "";
    if (passInput) passInput.value = "";
    
    pushLog("[LOGIN] Logged out");
    
    // SWITCH VIEW
    toggleViewToLogin();
}

// Attach listeners and run Seeder
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLoginSubmit);
    }
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", handleLogout);
    }

    setTimeout(seedUsers, 2000);
});