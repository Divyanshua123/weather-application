const API_BASE = "http://127.0.0.1:5000";
const AUTH_TOKEN_KEY = "skycast_token";

if (localStorage.getItem(AUTH_TOKEN_KEY)) {
    window.location.replace("index.html");
}

const messageBox = document.getElementById("messageBox");

function showMessage(message, type = "error") {
    messageBox.textContent = message;
    messageBox.className = `message ${type}`;
}

async function submitAuth(url, payload, successMessage, redirect = false) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/${url}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `${url} failed`);
        }

        if (redirect) {
            localStorage.setItem(AUTH_TOKEN_KEY, data.token);
            window.location.replace("index.html");
            return;
        }

        showMessage(successMessage, "success");
        document.getElementById("loginEmail").value = payload.email;
        document.getElementById("loginPassword").focus();
    } catch (error) {
        console.error(`${url} error:`, error);
        showMessage(error.message);
    }
}

document.getElementById("loginForm").addEventListener("submit", event => {
    event.preventDefault();
    submitAuth("login", {
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value
    }, "Login successful.", true);
});

document.getElementById("registerForm").addEventListener("submit", event => {
    event.preventDefault();
    submitAuth("register", {
        name: document.getElementById("registerName").value.trim(),
        email: document.getElementById("registerEmail").value.trim(),
        password: document.getElementById("registerPassword").value
    }, "Registration successful. Please sign in.");
});