import { 
    appState, 
    db, 
    USERS_COLLECTION_ROOT, 
    pushLog, 
    setActiveTab 
} from './kpi-core-v08.js';

import { 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// --- 1. SEED DEFAULT USERS ---
// สร้าง User ตามโจทย์ ถ้ายังไม่มีใน Database
async function seedUsers() {
    if (!db) return;
    
    const defaultUsers = [
        { username: 'admin', password: 'admin230049', role: 'Admin', displayName: 'Administrator' },
        { username: '4340', password: 'SGM4340**', role: 'Store Manager', displayName: 'Manager 4340' }, // Changed Role name
        { username: '4340s', password: '4340s', role: 'Store', displayName: 'Staff 4340' } // Changed Role name
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
        // ไม่ pushLog เพื่อไม่ให้รกหน้าจอ User ทั่วไป ยกเว้น error จริงจัง
    }
}

// --- 2. UI UPDATES ---
function updateUserDisplay() {
    const nameEl = document.getElementById("currentUserDisplay");
    const roleEl = document.getElementById("currentRoleDisplay");
    
    if (nameEl) {
        // Show displayName if available, else username
        nameEl.textContent = appState.displayName || appState.username || "-";
    }
    if (roleEl) {
        roleEl.textContent = appState.role || "-";
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
        // UI Loading State
        if(btnSubmit) {
            btnSubmit.innerHTML = 'Checking...';
            btnSubmit.disabled = true;
        }

        // Query Firestore: users/{username}
        const userRef = doc(db, USERS_COLLECTION_ROOT, username);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            throw new Error("ไม่พบผู้ใช้งานนี้ในระบบ");
        }

        const userData = userSnap.data();

        // Simple Password Check (Plaintext as per requirement)
        if (userData.password !== password) {
            throw new Error("รหัสผ่านไม่ถูกต้อง");
        }

        // Login Success
        appState.username = userData.username;
        appState.displayName = userData.displayName || userData.username;
        appState.role = userData.role; // Admin, Store Manager, Store

        updateUserDisplay();
        pushLog(`[LOGIN] Success: ${appState.username} (${appState.role})`);
        
        if (passInput) passInput.value = ""; // Clear password
        
        // Auto-redirect to Input tab
        setActiveTab("tab-input");

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
    updateUserDisplay();
    
    const nameInput = document.getElementById("loginName");
    const passInput = document.getElementById("loginPassword");
    if (nameInput) nameInput.value = "";
    if (passInput) passInput.value = "";
    
    pushLog("[LOGIN] Logged out");
    setActiveTab("tab-login");
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

    // Attempt to seed users after a short delay to ensure DB connection
    setTimeout(seedUsers, 2000);
});