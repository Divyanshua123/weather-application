/* =========================
   SKYCAST PRO SCRIPT
========================= */

const cityInput =
    document.getElementById("cityInput");

const API_BASE = "http://127.0.0.1:5001";

let weatherChart = null;

/* =========================
   ENTER KEY SEARCH
========================= */

cityInput.addEventListener("keypress", e => {

    if (e.key === "Enter") {
        getWeather();
    }
});

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
   GET WEATHER
========================= */

async function getWeather() {

    const city =
        cityInput.value.trim();

    if (!city) {

        alert("Please enter city name");
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

        console.log(error);

        clearUI();

        alert(error.message);
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
            throw new Error("Forecast failed");
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

        console.log(error);
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

        console.log(error);

        document.getElementById("aqi").innerHTML =
            "Unavailable";
    }
}

/* =========================
   CHART
========================= */

function drawChart(data) {

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

        alert("Geolocation not supported");
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

                displayWeather(data);

                displayForecast(data.name);

                getAQI(lat, lon);

            }

            catch (error) {

                console.log(error);

                alert("Location weather failed");
            }
        },

        () => {
            alert("Location permission denied");
        }
    );
}

/* =========================
   VOICE SEARCH
========================= */

function startVoiceSearch() {

    if (!("webkitSpeechRecognition" in window)) {

        alert("Voice search not supported");
        return;
    }

    const recognition =
        new webkitSpeechRecognition();

    recognition.lang = "en-US";

    recognition.onresult = e => {

        cityInput.value =
            e.results[0][0].transcript;

        getWeather();
    };

    recognition.start();
}

/* =========================
   THEME TOGGLE
========================= */

const themeToggle =
    document.getElementById("themeToggle");

themeToggle.addEventListener("click", () => {

    document.body.classList.toggle("light-mode");

    themeToggle.innerHTML =
        document.body.classList.contains("light-mode")
            ? "☀"
            : "🌙";
});

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
   FAVORITES
========================= */

function saveFavorite() {

    const city =
        document.getElementById("city").innerHTML;

    if (city === "Display Weather") {

        alert("Search city first");
        return;
    }

    let favs =
        JSON.parse(
            localStorage.getItem("favorites")
        ) || [];

    if (!favs.includes(city)) {

        favs.push(city);
    }

    localStorage.setItem(
        "favorites",
        JSON.stringify(favs)
    );

    alert("City saved");
}

/* =========================
   HISTORY
========================= */

function saveHistory(city) {

    let history =
        JSON.parse(
            localStorage.getItem("history")
        ) || [];

    if (!history.includes(city)) {

        history.push(city);
    }

    localStorage.setItem(
        "history",
        JSON.stringify(history)
    );
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