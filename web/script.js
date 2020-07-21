let compareDistance = 1;

const maxRelativeChange = 2;
const countryDialogPadding = 8;
const chartWidth = 300;
const chartHeight = 100;

const world = document.getElementById("world");
const elementParameterDialogCompareDistanceText = document.getElementById("parameter-dialog-compareDistance-text");
const elementCountryDialog = document.getElementById("country-dialog");
const elementCountryDialogCountryName = document.getElementById("country-dialog-countryName");
const elementCountryDialogCompareData = document.getElementById("country-dialog-compareData");
const elementCountryDialogChange = document.getElementById("country-dialog-change");
const elementCountryDialogChart = document.getElementById("country-dialog-chart");
const elementCountryDialogArrow = document.getElementById("country-dialog-arrow");
const elementCountryDialogChartLegend = document.getElementById("country-dialog-chartLegend");

const elementLegendeFarben = document.getElementById("legende-farben");

// Legende befüllen
for (let i = -5; i <= 5; i++) {
    const factor = i / 5;
    const value = factor * maxRelativeChange;
    const color = getColor(value);

    const element = document.createElement("div");
    element.innerText = formatChange(value);
    element.style.backgroundColor = color;

    elementLegendeFarben.appendChild(element);
}

elementCountryDialogChart.style.width = `${chartWidth}px`;
elementCountryDialogChart.style.height = `${chartHeight}px`;
const chartContext = elementCountryDialogChart.getContext("2d");

const countryDictionary = {};

document.getElementById("parameter-dialog-compareDistance-decrease").addEventListener("click", () => changeCompareDistance(-1));
document.getElementById("parameter-dialog-compareDistance-increase").addEventListener("click", () => changeCompareDistance(1));

// Alle Pfad-Tags der Weltkarte durchgehen, als Land speichern und mit Mouse Listener versehen
for (const countryPath of world.getElementsByTagName("path")) {
    const countryKey = countryPath.getAttribute("data-id");
    const country = {
        path: countryPath,
        days: [],
        weeks: [],
    };

    countryDictionary[countryKey] = country;

    countryPath.addEventListener("mouseover", (event) => handleCountryMouseOver(event, country));
    countryPath.addEventListener("mouseout", (event) => handleCountryMouseOut(event, country));
}

updateCompareDistanceText();

d3.csv("./data/covid-data.csv").then(handleDataLoaded);

// Maus hat Land betreten
function handleCountryMouseOver(event, country) {
    const boundingBox = event.target.getBoundingClientRect();

    updateCountryDialogPosition(boundingBox);
    updateCountryDialogContent(country);

    // Dialog erhält Farbe des Landes als Randfarbe
    elementCountryDialog.style.borderColor = country.color || "#eee";
    elementCountryDialog.classList.add("visible");
}

// Neuinfizierten-Chart für das Land neu rendern
function renderChart(country) {
    const width = chartWidth * window.devicePixelRatio;
    const height = chartHeight * window.devicePixelRatio;

    elementCountryDialogChart.width = width;
    elementCountryDialogChart.height = height;

    chartContext.clearRect(0, 0, width, height);

    chartContext.strokeStyle = "#eee";

    const { weeks } = country;

    let x = 0;
    const barWidth = width / weeks.length;
    const indexNow = weeks.length - 1;
    const indexPast = indexNow - compareDistance;

    for (let i = 0; i < weeks.length; i++) {
        const barHeight = height * (weeks[i] / country.maxNewCases);

        const isCompared = i === indexNow || i === indexPast;
        chartContext.fillStyle = isCompared ? "#36e" : "#555";

        chartContext.fillRect(x, height - barHeight, barWidth, barHeight);
        chartContext.strokeRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth;
    }
}

function formatChange(change) {
    return `${change > 0 ? "+" : ""}${Math.round(change * 100)}%`;
}

// Name des Landes, Werte und Chart im Land-Dialog aktualisieren
function updateCountryDialogContent(country) {
    elementCountryDialogCountryName.innerText = country.name || "";

    if (country.newCasesPast != null) {
        const newCasesPastFormatted = Math.floor(country.newCasesPast).toLocaleString();
        const newCasesNowFormatted = Math.floor(country.newCasesNow).toLocaleString();

        elementCountryDialogCompareData.innerHTML = `<strong>${newCasesPastFormatted}</strong> Neuinfizierte vor ${formatCompareDistance()}</br><strong>${newCasesNowFormatted}</strong> Neuinfizierte in aktueller Woche`;

        elementCountryDialogChange.style.color = country.increased ? "red" : "green";
        elementCountryDialogChange.innerText = formatChange(country.factor);

        elementCountryDialogChart.style.display = "block";
        elementCountryDialogChartLegend.style.display = "block";

        renderChart(country);
    } else {
        elementCountryDialogCompareData.innerHTML = "Daten nicht vorhanden";
        elementCountryDialogChange.innerText = "";

        elementCountryDialogChart.style.display = "none";
        elementCountryDialogChartLegend.style.display = "none";
    }
}

// Dialog abhängig von der Position des Landes positionieren und ausrichten
function updateCountryDialogPosition(boundingBox) {
    const left = boundingBox.left + boundingBox.width / 2;
    let top = boundingBox.top;

    if (boundingBox.bottom < window.innerHeight / 2) {
        elementCountryDialog.classList.remove("flipped");

        top += boundingBox.height + countryDialogPadding;
    } else {
        top -= countryDialogPadding;
        elementCountryDialog.classList.add("flipped");
    }

    elementCountryDialog.style = `left: ${left}px; top: ${top}px`;
}

// Maus hat Land verlassen
function handleCountryMouseOut() {
    elementCountryDialog.classList.remove("visible");
}

// Neuinfizierte von 7 Tagen aufsummieren von lastIndex beginnend
function sumWeeklyData(data, lastIndex) {
    let sum = 0;

    for (let i = 0; i < 7; i++) {
        const parsedNumber = Number.parseInt(data[lastIndex - i].new_cases);
        sum += Math.max(0, parsedNumber); // Korrigierte Zahlen (negativ) werden ignoriert und als 0 gehandhabt
    }

    return sum;
}

// Array-Daten von CSV einlesen
function handleDataLoaded(data) {
    // Tägliche Daten dem richtigen Land zuteilen
    for (const dataRow of data) {
        const countryKey = dataRow.iso_code;
        const country = countryDictionary[countryKey];

        if (country) {
            country.days.push(dataRow);

            if (!country.name) {
                country.name = dataRow.location;
            }
        }
    }

    // Tägliche Neuinfektionen zu wöchentlichen Zahlen aggregieren
    for (const countryKey in countryDictionary) {
        const country = countryDictionary[countryKey];
        let max = 0;

        let index = country.days.length - 1;

        while (index >= 6) {
            const weeklyNewCases = sumWeeklyData(country.days, index);

            country.weeks.unshift(weeklyNewCases);

            if (weeklyNewCases > max) {
                max = weeklyNewCases;
            }

            index -= 7;
        }

        country.maxNewCases = max;
    }

    // Lade-Banner ausblenden
    document.getElementById("loading-banner").classList.add("hidden");

    // Erste Visualierung mit Standardeinstellung
    updateColors();
}

// Abstand zwischen beiden Wochen um einen bestimmten Faktor ändern
function changeCompareDistance(change) {
    compareDistance = Math.max(1, compareDistance + change);

    updateCompareDistanceText();
    updateColors();
}

function formatCompareDistance() {
    return `${compareDistance} Woche${compareDistance === 1 ? "" : "n"}`;
}

function updateCompareDistanceText() {
    elementParameterDialogCompareDistanceText.innerText = formatCompareDistance();
}

function buildColorString(red, green, blue) {
    return `rgb(${Math.floor(red * 255)}, ${Math.floor(green * 255)}, ${Math.floor(blue * 255)})`;
}

// Farbe für Änderung der Infektionszahlen zwischen zwei Wochen
function getColor(factor) {
    const increased = factor > 0;
    const normalizedFactor = Math.min(1, Math.abs(factor) / maxRelativeChange);

    const grayFactor = 0.4;
    const normalizedColorDelta = normalizedFactor * (1 - grayFactor);

    const red = grayFactor + (increased ? normalizedColorDelta : 0);
    const green = grayFactor + (increased ? 0 : normalizedColorDelta);
    const blue = grayFactor;

    return buildColorString(red, green, blue);
}

// Alle Länder iterieren, jeweiligen Unterschied zwischen den Wochen berechnen und jeweilige Farbe dem Pfad zuteilen
function updateColors() {
    for (const countryKey in countryDictionary) {
        const country = countryDictionary[countryKey];
        const indexNow = country.weeks.length - 1;
        const indexPast = indexNow - compareDistance;

        if (indexPast >= 0) {
            country.newCasesPast = country.weeks[indexPast];
            country.newCasesNow = country.weeks[indexNow];

            if (country.newCasesPast === 0) {
                if (country.newCasesNow === 0) {
                    // 0 -> 0
                    country.factor = 0;
                } else {
                    // 0 -> X
                    country.factor = 9.99;
                }
            } else {
                country.factor = country.newCasesNow / country.newCasesPast - 1;
            }

            country.increased = country.factor > 0;
        } else {
            country.newCasesPast = null;
            country.newCasesNow = null;
            country.factor = 0;
            country.increased = false;
        }

        country.color = getColor(country.factor);
        country.path.style.fill = country.color;
    }
}
