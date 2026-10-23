const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

let temperatureChart;
let rainfallChart;
let trendChart;
let forecastChart;

const $ = id => document.getElementById(id);

// Fetch JSON data from an API
async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Weather API error: " + response.status);
    }

    return response.json();
}

// Create or update a chart
function drawChart(oldChart, canvasId, type, labels, datasets, title) {
    const canvas = $(canvasId);

    if (!canvas) {
        console.error("Canvas not found:", canvasId);
        return oldChart;
    }

    if (typeof Chart === "undefined") {
        throw new Error("Chart.js is not loaded. Check index.html.");
    }

    if (oldChart) {
        oldChart.destroy();
    }

    return new Chart(canvas, {
        type: type,

        data: {
            labels: labels,
            datasets: datasets
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                title: {
                    display: Boolean(title),
                    text: title,
                    color: "#ffffff"
                },

                legend: {
                    labels: {
                        color: "#ffffff"
                    }
                }
            },

            scales: {
                x: {
                    ticks: {
                        color: "#ffffff"
                    },
                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    }
                },

                y: {
                    beginAtZero: type === "bar",
                    ticks: {
                        color: "#ffffff"
                    },
                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    }
                }
            }
        }
    });
}

// Main weather dashboard function
async function loadWeather() {
    const city = $("city")?.value.trim() || "Bengaluru";
    const selectedYear =
        Number($("year")?.value) || new Date().getFullYear();

    try {
        if ($("status")) {
            $("status").textContent = "Loading weather data...";
        }

        ["avgTemp", "maxTemp", "minTemp", "rainfall"].forEach(id => {
            if ($(id)) {
                $(id).textContent = "Loading...";
            }
        });

        // 1. Find city coordinates
        const geo = await fetchJSON(
            "https://geocoding-api.open-meteo.com/v1/search?name=" +
            encodeURIComponent(city) +
            "&count=1&language=en&format=json"
        );

        if (!geo.results?.length) {
            throw new Error("City not found. Please try another city.");
        }

        const place = geo.results[0];
        const latitude = place.latitude;
        const longitude = place.longitude;

        if ($("cityName")) {
            $("cityName").textContent = `Weather in ${place.name}`;
        }

        // 2. Fetch current weather and forecast
        const forecastParams = new URLSearchParams({
            latitude,
            longitude,
            current:
                "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
            daily:
                "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
            past_days: "6",
            forecast_days: "7",
            timezone: "auto"
        });

        const weather = await fetchJSON(
            "https://api.open-meteo.com/v1/forecast?" +
            forecastParams
        );

        // 3. Update weather cards
        if ($("avgTemp")) {
            $("avgTemp").textContent =
                weather.current.temperature_2m + " °C";
        }

        if ($("maxTemp")) {
            $("maxTemp").textContent =
                Math.max(...weather.daily.temperature_2m_max) + " °C";
        }

        if ($("minTemp")) {
            $("minTemp").textContent =
                Math.min(...weather.daily.temperature_2m_min) + " °C";
        }

        const totalRain = weather.daily.precipitation_sum.reduce(
            (sum, value) => sum + (value || 0),
            0
        );

        if ($("rainfall")) {
            $("rainfall").textContent = totalRain.toFixed(1) + " mm";
        }

        if ($("humidity")) {
            $("humidity").textContent =
                weather.current.relative_humidity_2m + "%";
        }

        if ($("wind")) {
            $("wind").textContent =
                weather.current.wind_speed_10m + " km/h";
        }

        if ($("currentTemp")) {
            $("currentTemp").textContent =
                weather.current.temperature_2m + " °C";
        }

        if ($("currentRain")) {
            $("currentRain").textContent =
                weather.current.precipitation + " mm";
        }

        // 4. Prepare forecast data
        const dates = weather.daily.time;
        const maxTemps = weather.daily.temperature_2m_max;
        const minTemps = weather.daily.temperature_2m_min;

        const forecastLabels = dates.map(date => {
            const d = new Date(date + "T12:00:00");

            return d.toLocaleDateString("en", {
                day: "numeric",
                month: "short"
            });
        });

        const forecastData = maxTemps.map((max, i) =>
            (max + minTemps[i]) / 2
        );

        // 5. Seven-day temperature forecast
        forecastChart = drawChart(
            forecastChart,
            "forecastChart",
            "line",
            forecastLabels,
            [{
                label: "Daily Average Temperature (°C)",
                data: forecastData,
                borderColor: "#ffad5c",
                backgroundColor: "rgba(255,173,92,0.15)",
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }],
            "7-Day Temperature Forecast"
        );

        // 6. Daily rainfall chart
        rainfallChart = drawChart(
            rainfallChart,
            "rainfallChart",
            "bar",
            forecastLabels,
            [{
                label: "Daily Rainfall (mm)",
                data: weather.daily.precipitation_sum,
                backgroundColor: "#873bdb"
            }],
            "Daily Rainfall"
        );

        // 7. Fetch historical data for the selected year
        const today = new Date();
        const currentYear = today.getFullYear();

        // Use yesterday for the current year
        const yesterday = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - 1
        );

        const archiveEndDate = selectedYear === currentYear
            ? [
                yesterday.getFullYear(),
                String(yesterday.getMonth() + 1).padStart(2, "0"),
                String(yesterday.getDate()).padStart(2, "0")
            ].join("-")
            : `${selectedYear}-12-31`;

        const archiveStartDate = `${selectedYear}-01-01`;

        if (archiveEndDate < archiveStartDate) {
            throw new Error("Please select a valid year.");
        }

        const archiveParams = new URLSearchParams({
            latitude,
            longitude,
            start_date: archiveStartDate,
            end_date: archiveEndDate,
            daily: "temperature_2m_mean,precipitation_sum",
            timezone: "auto"
        });

        const archive = await fetchJSON(
            "https://archive-api.open-meteo.com/v1/archive?" +
            archiveParams
        );

        if (
            !archive.daily ||
            !Array.isArray(archive.daily.time) ||
            !Array.isArray(archive.daily.temperature_2m_mean) ||
            !Array.isArray(archive.daily.precipitation_sum)
        ) {
            throw new Error("Historical weather data is unavailable.");
        }

        // 8. Calculate monthly temperature and rainfall
        const monthlySums = Array(12).fill(0);
        const monthlyCounts = Array(12).fill(0);
        const monthlyRain = Array(12).fill(0);

        archive.daily.time.forEach((date, i) => {
            const monthIndex = Number(date.slice(5, 7)) - 1;

            const temperature =
                archive.daily.temperature_2m_mean[i];

            const rain =
                archive.daily.precipitation_sum[i];

            if (temperature !== null && temperature !== undefined) {
                monthlySums[monthIndex] += temperature;
                monthlyCounts[monthIndex]++;
            }

            if (rain !== null && rain !== undefined) {
                monthlyRain[monthIndex] += rain;
            }
        });

        const monthlyTemperatures = monthlySums.map((sum, i) =>
            monthlyCounts[i] > 0
                ? Number((sum / monthlyCounts[i]).toFixed(1))
                : null
        );

        const monthlyRainfall = monthlyRain.map(value =>
            Number(value.toFixed(1))
        );

        // 9. Monthly temperature seasonality chart
        temperatureChart = drawChart(
            temperatureChart,
            "temperatureChart",
            "line",
            months,
            [{
                label: `Average Temperature (°C) — ${selectedYear}`,
                data: monthlyTemperatures,
                borderColor: "#ad76ff",
                backgroundColor: "rgba(173,118,255,0.15)",
                pointRadius: 4,
                fill: true,
                tension: 0.3,
                spanGaps: false
            }],
            "Monthly Temperature Seasonality"
        );

        // 10. Yearly Trend Analysis chart
        trendChart = drawChart(
            trendChart,
            "trendChart",
            "line",
            months,
            [{
                label: `Monthly Average Temperature (°C) — ${selectedYear}`,
                data: monthlyTemperatures,
                borderColor: "#ff6b6b",
                backgroundColor: "rgba(255,107,107,0.15)",
                pointRadius: 5,
                fill: true,
                tension: 0.3,
                spanGaps: false
            }],
            `Yearly Trend Analysis — ${selectedYear}`
        );

        // Log monthly rainfall for debugging
        console.log("Historical monthly rainfall:", monthlyRainfall);

        // 11. Update forecast table
        const tableBody = $("forecastTableBody");

        if (tableBody) {
            tableBody.innerHTML = dates.map((date, i) => `
                <tr>
                    <td>${date}</td>
                    <td>${maxTemps[i]} °C</td>
                    <td>${minTemps[i]} °C</td>
                    <td>${weather.daily.precipitation_sum[i]} mm</td>
                    <td>${weather.daily.precipitation_probability_max[i] ?? "N/A"}%</td>
                </tr>
            `).join("");
        }

        // 12. Update status
        if ($("status")) {
            $("status").textContent =
                `Weather updated for ${place.name}.`;
        }

        console.log("Weather dashboard updated successfully.");

    } catch (error) {
        console.error("Weather dashboard error:", error);

        if ($("status")) {
            $("status").textContent =
                "Error: " + error.message;
        } else {
            alert(error.message);
        }
    }
}

// Search button
if ($("searchBtn")) {
    $("searchBtn").addEventListener("click", loadWeather);
}

// Search using Enter key
if ($("city")) {
    $("city").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            loadWeather();
        }
    });
}

// Reload charts when the selected year changes
if ($("year")) {
    $("year").addEventListener("change", loadWeather);
}

// Load data when the page opens
loadWeather();