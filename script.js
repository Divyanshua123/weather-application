/* =========================
   SKYCAST PRO SCRIPT
========================= */

const cityInput =
    document.getElementById("cityInput");

const API_BASE = "http://127.0.0.1:5000";
const AUTH_TOKEN_KEY = "skycast_token";
const MESSAGE_TIMEOUT = 4500;

let weatherChart = null;
let messageTimer = null;

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token) {
    if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
    }
}

function getAuthHeaders() {
    const token = getAuthToken();
    return token
        ? { Authorization: `Bearer ${token}` }
        : {};
}

function updateAuthUI() {
    if (!getAuthToken()) {
        window.location.replace("auth.html");
    }
}

function showMessage(message, type = "error") {
    const messageBox = document.getElementById("messageBox");
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.classList.remove("d-none", "error", "success");
    messageBox.classList.add(type === "success" ? "success" : "error");

    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
        messageBox.classList.add("d-none");
    }, MESSAGE_TIMEOUT);
}

function clearMessage() {
    const messageBox = document.getElementById("messageBox");
    if (!messageBox) return;
    messageBox.textContent = "";
    messageBox.classList.add("d-none");
}

async function loginUser() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
        showErrorOnce("Please enter email and password.");
        return;
    }

    try {
        showLoader();

        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Login failed");
        }

        setAuthToken(data.token);
        updateAuthUI();
        loadFavorites();
        loadHistory();
        showErrorOnce("Login successful.");
    } catch (error) {
        console.error("Login error:", error);
        showErrorOnce(error.message);
    } finally {
        hideLoader();
    }
}

async function registerUser() {
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    if (!name || !email || !password) {
        showErrorOnce("Please fill name, email, and password.");
        return;
    }

    try {
        showLoader();

        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Registration failed");
        }

        showErrorOnce("Registration successful. Please log in.");
    } catch (error) {
        console.error("Register error:", error);
        showErrorOnce(error.message);
    } finally {
        hideLoader();
    }
}

function logoutUser() {
    setAuthToken(null);
    window.location.replace("auth.html");
}

async function loadFavorites() {
    const token = getAuthToken();
    const container = document.getElementById("favoritesList");

    if (!token) {
        container.innerHTML = "Login to see backend favorites.";
        return;
    }

    try {
        showLoader();
        const response = await fetch(`${API_BASE}/api/favorites`, {
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load favorites");
        }

        if (data.length === 0) {
            container.innerHTML = "No favorites saved yet.";
            return;
        }

        container.innerHTML = data
            .map(item => `
                <div>
                    ${item.city}${item.country ? `, ${item.country}` : ""}
                    <button class="small-button" onclick="deleteFavorite(${item.id})">Remove</button>
                </div>
            `)
            .join("");
    } catch (error) {
        console.error("Load favorites error:", error);
        container.innerHTML = error.message;
    } finally {
        hideLoader();
    }
}

async function deleteFavorite(id) {
    try {
        showLoader();
        const response = await fetch(`${API_BASE}/api/favorites/${id}`, {
            method: "DELETE",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to delete favorite");
        }

        loadFavorites();
        showErrorOnce("Favorite removed.");
    } catch (error) {
        console.error("Delete favorite error:", error);
        showErrorOnce(error.message);
    } finally {
        hideLoader();
    }
}

async function loadHistory() {
    const token = getAuthToken();
    const container = document.getElementById("historyList");

    if (!token) {
        const history = JSON.parse(localStorage.getItem("history")) || [];
        container.innerHTML = history.length
            ? history.map(city => `<div>${city}</div>`).join("")
            : "No history saved yet.";
        return;
    }

    try {
        showLoader();
        const response = await fetch(`${API_BASE}/api/history`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load history");
        }

        if (data.length === 0) {
            container.innerHTML = "No history saved yet.";
            return;
        }

        container.innerHTML = data
            .map(item => `<div>${item.city} <small>${new Date(item.searched_at).toLocaleString()}</small></div>`)
            .join("");
    } catch (error) {
        console.error("Load history error:", error);
        container.innerHTML = error.message;
    } finally {
        hideLoader();
    }
}

async function saveHistory(city) {
    const token = getAuthToken();

    if (!token) {
        let history = JSON.parse(localStorage.getItem("history")) || [];
        if (!history.includes(city)) {
            history.push(city);
            localStorage.setItem("history", JSON.stringify(history));
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/history`, {
            method: "POST",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ city })
        });

        if (!response.ok) {
            const data = await response.json();
            console.error("Save history failed:", data.message || response.statusText);
        }
    } catch (error) {
        console.error("Save history error:", error);
    }
}

async function saveFavorite() {
    const city = document.getElementById("city").innerText;

    if (city === "Display Weather") {
        showErrorOnce("Search a city first.");
        return;
    }

    const token = getAuthToken();

    if (!token) {
        showErrorOnce("Login to save favorites.");
        return;
    }

    try {
        showLoader();
        const response = await fetch(`${API_BASE}/api/favorites`, {
            method: "POST",
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ city })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to save favorite");
        }

        loadFavorites();
        showMessage("City saved to favorites.", "success");
    } catch (error) {
        console.error("Save favorite error:", error);
        showErrorOnce(error.message);
    } finally {
        hideLoader();
    }
}

function initializeUserState() {
    if (!getAuthToken()) {
        window.location.replace("auth.html");
        return;
    }
    loadFavorites();
    loadHistory();
}

window.addEventListener("DOMContentLoaded", initializeUserState);

/* =========================
   ENTER KEY SEARCH
========================= */

if (cityInput) {
    cityInput.addEventListener("keypress", e => {
        if (e.key === "Enter") {
            getWeather();
        }
    });
}

/* =========================
   DATE
========================= */

function updateDate() {

    const now = new Date();

    document.getElementById("date").innerHTML =
        now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
}

updateDate();

/* =========================
   DEDUPED ERROR ALERT
   Avoid showing the same alert repeatedly
========================= */

const _lastError = { msg: null, timer: null };

function showErrorOnce(message) {

    if (!message) return;

    // if same message recently shown, ignore
    if (message === _lastError.msg) return;

    _lastError.msg = message;
    showMessage(message, "error");

    clearTimeout(_lastError.timer);
    _lastError.timer = setTimeout(() => {
        _lastError.msg = null;
    }, 3000);
}

/* =========================
   GET WEATHER
========================= */

async function getWeather() {

    const city =
        cityInput.value.trim();

    if (!city) {
        showErrorOnce("Please enter city name.");
        return;
    }

    saveHistory(city);

    try {

        showLoader();

        const response =
            await fetch(
                `${API_BASE}/weather/${encodeURIComponent(city)}`
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message || "City not found"
            );
        }

        displayWeather(data);

        displayForecast(city);

        getAQI(
            data.coord.lat,
            data.coord.lon
        );

    }

    catch (error) {

        console.error("Weather fetch error:", error);

        clearUI();

        showErrorOnce(error.message);
    }

    finally {

        hideLoader();
    }
}

/* =========================
   DISPLAY WEATHER
========================= */

function displayWeather(data) {

    document.getElementById("city").innerHTML =
        `${data.name}, ${data.sys.country}`;

    document.getElementById("temp").innerHTML =
        `${Math.round(data.main.temp)}°C`;

    document.getElementById("weather").innerHTML =
        data.weather[0].description;

    document.getElementById("humidity").innerHTML =
        `${data.main.humidity}%`;

    document.getElementById("wind").innerHTML =
        `${data.wind.speed} m/s`;

    document.getElementById("country").innerHTML =
        data.sys.country;

    document.getElementById("feelsLike").innerHTML =
        `${Math.round(data.main.feels_like)}°C`;

    document.getElementById("sunrise").innerHTML =
        formatTime(data.sys.sunrise);

    document.getElementById("sunset").innerHTML =
        formatTime(data.sys.sunset);

    /* WEATHER ICON */

    const weatherIcon =
        document.getElementById("weatherIcon");

    weatherIcon.src =
        `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;

    weatherIcon.classList.remove("d-none");

    /* GOOGLE MAP */

    document.getElementById("mapFrame").src =
        `https://maps.google.com/maps?q=${data.coord.lat},${data.coord.lon}&z=10&output=embed`;

    const weather =
        data.weather[0].main;

    updateBackground(weather);

    updateWeatherLogic(weather);

    document.getElementById("travel").innerHTML =
        travelSuggestion(weather);
}

/* =========================
   WEATHER LOGIC
========================= */

function updateWeatherLogic(weather) {

    let rating = "";
    let precaution = "";
    let clothes = "";

    switch (weather) {

        case "Clear":

            rating = "Excellent ⭐⭐⭐⭐⭐";
            precaution =
                "Use sunscreen and stay hydrated.";
            clothes =
                "T-shirt and sunglasses.";
            break;

        case "Rain":

            rating = "Moderate ⭐⭐⭐";
            precaution =
                "Carry umbrella.";
            clothes =
                "Raincoat recommended.";
            break;

        case "Clouds":

            rating = "Good ⭐⭐⭐⭐";
            precaution =
                "Weather may change anytime.";
            clothes =
                "Light hoodie.";
            break;

        case "Snow":

            rating = "Cold ❄";
            precaution =
                "Avoid slippery roads.";
            clothes =
                "Wear heavy winter clothes.";
            break;

        default:

            rating = "Normal ⭐⭐⭐";
            precaution =
                "Check weather updates.";
            clothes =
                "Comfortable casual clothes.";
    }

    document.getElementById("rating").innerHTML =
        rating;

    document.getElementById("precaution").innerHTML =
        precaution;

    document.getElementById("clothes").innerHTML =
        clothes;
}

/* =========================
   FORECAST
========================= */

async function displayForecast(city) {

    try {

        const response =
            await fetch(
                `${API_BASE}/forecast/${encodeURIComponent(city)}`
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Forecast failed");
        }

        const container =
            document.getElementById(
                "forecastContainer"
            );

        container.innerHTML = "";

        const dailyData =
            data.list.filter(item =>
                item.dt_txt.includes("12:00:00")
            );

        dailyData.forEach(day => {

            const div =
                document.createElement("div");

            div.className =
                "forecast-card";

            div.innerHTML = `
                <h4>
                    ${new Date(day.dt_txt)
                        .toLocaleDateString(
                            "en-US",
                            { weekday: "short" }
                        )}
                </h4>

                <img src="
                https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png">

                <p>
                    ${Math.round(day.main.temp)}°C
                </p>

                <small>
                    ${day.weather[0].main}
                </small>
            `;

            container.appendChild(div);
        });

        drawChart(data);

    }

    catch (error) {

        console.error("Forecast display error:", error);
        document.getElementById("forecastContainer").innerHTML =
            "<p>Unable to load forecast</p>";
    }
}

/* =========================
   AQI
========================= */

async function getAQI(lat, lon) {

    try {

        const response =
            await fetch(
                `${API_BASE}/air-quality/${lat}/${lon}`
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Air quality data unavailable");
        }

        if (!data.air || !data.air.list || !data.air.list[0] || !data.air.list[0].main) {
            throw new Error("Invalid air quality data structure");
        }

        const aqi =
            data.air.list[0].main.aqi;

        let quality = "";

        switch (aqi) {

            case 1:
                quality = "Good 😊";
                break;

            case 2:
                quality = "Fair 🙂";
                break;

            case 3:
                quality = "Moderate 😐";
                break;

            case 4:
                quality = "Poor 😷";
                break;

            case 5:
                quality = "Very Poor ☠";
                break;

            default:
                quality = "Unknown";
        }

        document.getElementById("aqi").innerHTML =
            quality;

    }

    catch (error) {

        console.error("AQI fetch error:", error);

        document.getElementById("aqi").innerHTML =
            "Unavailable";
    }
}

/* =========================
   CHART
========================= */

function drawChart(data) {

    try {
        const temps =
            data.list.slice(0, 8).map(
                item => item.main.temp
            );

        const labels =
            data.list.slice(0, 8).map(
                item => item.dt_txt.split(" ")[1]
            );

        if (weatherChart) {
            weatherChart.destroy();
        }

        weatherChart =
            new Chart(
                document.getElementById("tempChart"),
                {
                    type: "line",

                    data: {

                        labels,

                        datasets: [{
                            label: "Temperature °C",
                            data: temps,
                            borderColor: "#60a5fa",
                            tension: 0.4,
                            fill: false
                        }]
                    }
                }
            );
    } catch (error) {
        console.error("Chart rendering error:", error);
    }
}

/* =========================
   FORMAT TIME
========================= */

function formatTime(unix) {

    return new Date(unix * 1000)
        .toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
}

/* =========================
   GEOLOCATION
========================= */

function getCurrentLocation() {

    if (!navigator.geolocation) {
        showErrorOnce("Geolocation not supported.");
        return;
    }

    navigator.geolocation.getCurrentPosition(

        async position => {

            const lat =
                position.coords.latitude;

            const lon =
                position.coords.longitude;

            try {

                const response =
                    await fetch(
                        `${API_BASE}/weather-location/${lat}/${lon}`
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Location weather failed");
                }

                displayWeather(data);

                displayForecast(data.name);

                getAQI(lat, lon);

            }

            catch (error) {

                console.error("Location weather error:", error);

                showErrorOnce("Location weather failed: " + error.message);
            }
        },

        () => {
            console.error("Location permission denied");
            showErrorOnce("Location permission denied");
        }
    );
}

/* =========================
   VOICE SEARCH
========================= */

function startVoiceSearch() {

    if (!("webkitSpeechRecognition" in window)) {
        showErrorOnce("Voice search not supported.");
        return;
    }

    try {
        const recognition =
            new webkitSpeechRecognition();

        recognition.lang = "en-US";

        recognition.onresult = e => {

            if (!e.results || !e.results[0]) {
                throw new Error("No speech recognized");
            }

            cityInput.value =
                e.results[0][0].transcript;

            getWeather();
        };

        recognition.onerror = error => {
            console.error("Speech recognition error:", error);
            showErrorOnce("Voice search failed: " + error.error);
        };

        recognition.start();
    } catch (error) {
        console.error("Voice search initialization error:", error);
        showErrorOnce("Voice search failed");
    }
}

/* =========================
   THEME TOGGLE
========================= */

const themeToggle =
    document.getElementById("themeToggle");

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        themeToggle.innerHTML =
            document.body.classList.contains("light-mode")
                ? "☀"
                : "🌙";
    });
}

/* =========================
   BACKGROUND
========================= */

function updateBackground(weather) {

    if (weather === "Rain") {

        document.body.style.background =
            "linear-gradient(to right,#4b6cb7,#182848)";
    }

    else if (weather === "Clear") {

        document.body.style.background =
            "linear-gradient(to right,#f7971e,#ffd200)";
    }

    else {

        document.body.style.background =
            "linear-gradient(135deg,#0f172a,#1e293b,#0f172a)";
    }
}


/* =========================
   TRAVEL
========================= */

function travelSuggestion(weather) {

    if (weather === "Rain") {
        return "Carry umbrella. Indoor travel recommended.";
    }

    if (weather === "Snow") {
        return "Avoid highways and wear thermal clothes.";
    }

    if (weather === "Clear") {
        return "Perfect weather for sightseeing.";
    }

    return "Good weather for normal travel.";
}

/* =========================
   CLEAR UI
========================= */

function clearUI() {

    document.getElementById("city").innerHTML =
        "Display Weather";

    const ids = [
        "temp",
        "weather",
        "humidity",
        "wind",
        "country",
        "feelsLike",
        "sunrise",
        "sunset",
        "rating",
        "precaution",
        "clothes",
        "aqi",
        "travel"
    ];

    ids.forEach(id => {

        document.getElementById(id).innerHTML = "";
    });

    document.getElementById(
        "forecastContainer"
    ).innerHTML = "";

    document.getElementById(
        "mapFrame"
    ).src = "";
}

/* =========================
   LOADER
========================= */

function showLoader() {

    document
        .getElementById("loader")
        .classList.remove("d-none");
}

function hideLoader() {

    document
        .getElementById("loader")
        .classList.add("d-none");
}
