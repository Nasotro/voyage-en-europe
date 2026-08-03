// Coordonnées des villes (latitude, longitude)
let cities = [
    {
        name: "Paris",
        coords: [48.8566, 2.3522],
        description: "<b>Paris, France</b><br>Tour Eiffel, Musée du Louvre, Notre-Dame, Montmartre",
        days: 0,
        details: ""
    },
    {
        name: "Vienne",
        coords: [48.2082, 16.3738],
        description: "<b>Vienne, Autriche</b><br>Palais de Schönbrunn, Opéra, Café Central",
        days: 2,
        details: ""
    },
    {
        name: "Prague",
        coords: [50.0755, 14.4378],
        description: "<b>Prague, République Tchèque</b><br>Pont Charles, Château de Prague",
        days: 2,
        details: ""
    },
    {
        name: "Budapest",
        coords: [47.4979, 19.0402],
        description: "<b>Budapest, Hongrie</b><br>Parlement, Bains Széchenyi",
        days: 2,
        details: ""
    },
    {
        name: "Bratislava",
        coords: [48.1486, 17.1077],
        description: "<b>Bratislava, Slovaquie</b><br>Château, Vieille Ville",
        days: 1,
        details: ""
    },
    {
        name: "Munich",
        coords: [48.1351, 11.5820],
        description: "<b>Munich, Allemagne</b><br>Marienplatz, Englischer Garten",
        days: 2,
        details: ""
    },
    {
        name: "Salzbourg",
        coords: [47.8095, 13.0550],
        description: "<b>Salzbourg, Autriche</b><br>Forteresse de Hohensalzburg, Maison de Mozart",
        days: 2,
        details: ""
    },
    {
        name: "Paris",
        coords: [48.8566, 2.3522],
        description: "<b>Paris, France</b><br>Tour Eiffel, Musée du Louvre, Notre-Dame, Montmartre",
        days: 0,
        details: ""
    }
];

// Ordre des étapes pour le tracé
let routeOrder = [0, 1, 2, 3, 4, 5, 6, 7];

// Prix entre les villes (prix du trajet entre la ville i et la ville i+1) - prix réels 2026
// Paris→Vienne: ~€50, Vienne→Prague: ~€14, Prague→Budapest: ~€19, Budapest→Bratislava: ~€15
// Bratislava→Munich: ~€30, Munich→Salzbourg: ~€9, Salzbourg→Paris: ~€60
let routePrices = [50, 14, 19, 15, 30, 9, 60];

// Store map and markers for updates
let map;
let markers = [];
let polylines = [];

// Store start date for trip calculations
let startDate = new Date('2026-08-01');

const STORAGE_KEY = 'interrail-itinerary';

function saveToStorage() {
    const data = {
        cities: cities,
        routeOrder: routeOrder,
        routePrices: routePrices,
        startDate: startDate.toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    try {
        const data = JSON.parse(stored);
        if (data.cities && data.routeOrder) {
            cities = data.cities;
            routeOrder = data.routeOrder;
            routePrices = data.routePrices || [];
            if (data.startDate) {
                startDate = new Date(data.startDate);
            }
            return true;
        }
    } catch (e) {
        console.error('Failed to parse stored itinerary:', e);
    }
    return false;
}

// Helper function to convert city name to URL slug for Omio
function cityToSlug(cityName) {
    // Map French city names to English for Omio URLs
    const cityMap = {
        'paris': 'paris',
        'vienne': 'vienna',
        'prague': 'prague',
        'budapest': 'budapest',
        'bratislava': 'bratislava',
        'munich': 'munich',
        'salzbourg': 'salzburg',
        'salzburg': 'salzburg'
    };
    
    const normalized = cityName.toLowerCase().trim();
    // Check if we have a mapping
    if (cityMap[normalized]) {
        return cityMap[normalized];
    }
    // Otherwise, convert to slug (remove accents and special chars)
    return normalized
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth radius in km
    const lat1 = coord1[0] * Math.PI / 180;
    const lon1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[0] * Math.PI / 180;
    const lon2 = coord2[1] * Math.PI / 180;
    
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Format distance nicely
function formatDistance(km) {
    if (km < 1) return `${(km * 1000).toFixed(0)} m`;
    if (km < 100) return `${km.toFixed(0)} km`;
    return `${km.toFixed(0)} km`;
}

// Format date as DD/MM/YYYY for Omio URLs
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Format date as DD mon (e.g., 04 sep)
function formatShortDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = monthNames[date.getMonth()];
    return `${day} ${month}`;
}

// Extract country from city description
function getCountry(city) {
    // Description format: <b>City, Country</b><br>...
    const boldMatch = city.description.match(/<b>([^<]+)<\/b>/);
    if (boldMatch) {
        const parts = boldMatch[1].split(',').map(p => p.trim());
        if (parts.length >= 2) {
            return parts[1];
        }
    }
    return '';
}

// Country name to ISO code mapping (supports French names)
const countryToIso = {
    'france': 'FR',
    'autriche': 'AT',
    'république tchèque': 'CZ',
    'tchèque': 'CZ',
    'hongrie': 'HU',
    'slovaquie': 'SK',
    'allemagne': 'DE',
    // Add more countries here as needed
    'belgique': 'BE',
    'pays-bas': 'NL',
    'suisse': 'CH',
    'italie': 'IT',
    'espagne': 'ES',
    'roumanie': 'RO',
    'pologne': 'PL',
    'croatie': 'HR',
    'slovénie': 'SI',
    'serbie': 'RS',
    'bosnie': 'BA',
    'monténégro': 'ME',
    'luxembourg': 'LU',
    'danemark': 'DK',
    'suède': 'SE',
    'norvège': 'NO',
    'finlande': 'FI',
    'royaume-uni': 'GB',
    'irlande': 'IE',
    'portugal': 'PT',
    'grèce': 'GR',
    'turquie': 'TR',
    'russie': 'RU',
    'ukraine': 'UA'
};

// Convert ISO country code to flag emoji
function getFlagFromCode(code) {
    if (!code || code.length !== 2) return '';
    const codeUpper = code.toUpperCase();
    // Regional indicator symbols start at U+1F1E6
    const offset = 0x1F1E6;
    const firstChar = codeUpper.charCodeAt(0) - 65; // A = 0
    const secondChar = codeUpper.charCodeAt(1) - 65; // A = 0
    const firstSymbol = String.fromCodePoint(offset + firstChar);
    const secondSymbol = String.fromCodePoint(offset + secondChar);
    return firstSymbol + secondSymbol;
}

// Get flag emoji and country name for display
function getCountryDisplay(countryName) {
    const normalized = countryName.toLowerCase().trim();
    const iso = countryToIso[normalized] || '';
    const flag = iso ? getFlagFromCode(iso) : '';
    return { flag, country: countryName };
}

// Global variables to track open panels
window.currentOpenCityIndex = null;
window.currentOpenTripIndex = null;

// Close all edit panels (city and trip)
window.closeAllPanels = function() {
    const cityPanels = document.querySelectorAll('.city-edit-panel');
    cityPanels.forEach(panel => {
        panel.style.display = 'none';
    });
    
    const tripPanels = document.querySelectorAll('.trip-edit-panel');
    tripPanels.forEach(panel => {
        panel.style.display = 'none';
    });
    
    window.currentOpenCityIndex = null;
    window.currentOpenTripIndex = null;
};

// Close all city edit panels
window.closeAllCityPanels = function() {
    const panels = document.querySelectorAll('.city-edit-panel');
    panels.forEach(panel => {
        panel.style.display = 'none';
    });
    window.currentOpenCityIndex = null;
};

// Delete a city from its edit panel
window.deleteCityFromPanel = function(cityIndex) {
    const city = cities[cityIndex];
    if (confirm(`Supprimer ${city.name} de l'itinéraire?`)) {
        // Find the position of this city in routeOrder
        const position = routeOrder.indexOf(cityIndex);
        if (position !== -1) {
            // Remove from routeOrder
            routeOrder.splice(position, 1);
            // Remove corresponding price (if this is not the last city)
            if (position < routePrices.length) {
                routePrices.splice(position, 1);
            }
            // Close all panels
            closeAllPanels();
            // Update everything
            drawMap();
        }
    }
};

// Add a new city from the timeline
window.addCityFromTimeline = function() {
    const newCity = {
        name: 'Nouvelle Ville',
        coords: [0, 0],
        description: '',
        days: 1,
        details: ''
    };
    cities.push(newCity);
    routeOrder.push(cities.length - 1);
    routePrices.push(0);
    drawMap();
    
    setTimeout(() => {
        const newCityIndex = cities.length - 1;
        const panel = document.getElementById(`cityEditPanel-${newCityIndex}`);
        if (panel) {
            // Close all other panels first
            window.closeAllCityPanels();
            // Open the new city's panel
            panel.style.display = 'block';
            window.currentOpenCityIndex = newCityIndex;
            
            // Focus on the name input
            const nameInput = document.getElementById(`nameInput-${newCityIndex}`);
            if (nameInput) {
                nameInput.focus();
                nameInput.select(); // Select all text so user can start typing immediately
            }
        }
        
        // Scroll to the new city
        const timeline = document.getElementById('itineraryTimeline');
        if (timeline) {
            const newCityNode = timeline.querySelector(`[data-city-index="${newCityIndex}"]`);
            if (newCityNode) {
                newCityNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                timeline.scrollTop = timeline.scrollHeight;
            }
        }
    }, 100);
};

// Update the days for a city and refresh the display
window.updateCityDaysFromPanel = function(cityIndex, days) {
    const city = cities[cityIndex];
    city.days = parseInt(days) || 1;
    
    // Update the timeline display
    renderTimeline();
    
    // Update the recap panel
    updateRecapPanel();
    
    saveToStorage();

    // Close the panel after update
    closeAllPanels();
};

// Update city name and days from timeline panel
window.updateCityFromPanel = function(cityIndex, name, days) {
    const city = cities[cityIndex];
    const nameChanged = name && name !== city.name;
    city.name = name || city.name;
    city.days = parseInt(days) || 1;
    
    // Update the timeline display
    renderTimeline();
    
    // Update the recap panel
    updateRecapPanel();
    
    saveToStorage();

    // Geocode if the name changed
    if (nameChanged) {
        const nameInput = document.getElementById(`nameInput-${cityIndex}`);
        if (nameInput) {
            geocodeCity(city, nameInput);
        }
    }
    
    // Close the panel after update
    closeAllPanels();
};

// Toggle trip edit panel
window.toggleTripEdit = function(tripIndex) {
    const panel = document.getElementById(`tripEditPanel-${tripIndex}`);
    if (panel) {
        if (panel.style.display === 'block') {
            panel.style.display = 'none';
            window.currentOpenTripIndex = null;
        } else {
            window.closeAllPanels();
            panel.style.display = 'block';
            window.currentOpenTripIndex = tripIndex;
        }
    }
};

// Update the price for a trip and refresh the display
window.updateTripPriceFromPanel = function(tripIndex, price) {
    // Handle empty input
    if (!price || price.trim() === '') {
        routePrices[tripIndex] = 0;
    } else {
        // Remove € symbol and any non-numeric characters
        const cleanedPrice = price.replace(/[^0-9.]/g, '');
        const numericPrice = parseFloat(cleanedPrice) || 0;
        routePrices[tripIndex] = numericPrice;
    }
    
    // Update the timeline display
    renderTimeline();
    
    // Update the recap panel
    updateRecapPanel();
    
    saveToStorage();

    // Close the panel after update
    closeAllPanels();
};

// ==========================================
// City Details Modal
// ==========================================

window.openCityDetails = function(cityIndex) {
    const city = cities[cityIndex];
    let modal = document.getElementById('cityDetailsModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cityDetailsModal';
        modal.className = 'details-modal-overlay';
        modal.innerHTML = `
            <div class="details-modal">
                <div class="details-modal-header">
                    <h2 id="detailsModalTitle">Détails de la ville</h2>
                    <button class="details-modal-close" onclick="window.closeCityDetails()">×</button>
                </div>
                <div class="details-modal-body">
                    <textarea id="detailsTextarea" placeholder="Ajoutez des notes, points d'intérêt, adresses..."></textarea>
                </div>
                <div class="details-modal-footer">
                    <button class="btn btn-primary" onclick="window.closeCityDetails()">Fermer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                window.closeCityDetails();
            }
        });
    }
    
    document.getElementById('detailsModalTitle').textContent = `Détails - ${city.name}`;
    document.getElementById('detailsTextarea').value = city.details || '';
    modal.dataset.cityIndex = cityIndex;
    modal.style.display = 'flex';
    
    document.getElementById('detailsTextarea').focus();
};

window.closeCityDetails = function() {
    const modal = document.getElementById('cityDetailsModal');
    if (modal) {
        const cityIndex = parseInt(modal.dataset.cityIndex);
        if (!isNaN(cityIndex) && cities[cityIndex]) {
            cities[cityIndex].details = document.getElementById('detailsTextarea').value;
            saveToStorage();
        }
        modal.style.display = 'none';
    }
};

// ==========================================
// Render Timeline
// ==========================================
function renderTimeline() {
    const timeline = document.getElementById('itineraryTimeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    
    // Add Add City button at the top of the timeline
    const addCityBtn = document.createElement('div');
    addCityBtn.className = 'add-city-timeline-btn';
    addCityBtn.innerHTML = '<button class="btn btn-primary" onclick="window.addCityFromTimeline()">+ Ajouter une ville</button>';
    timeline.appendChild(addCityBtn);
    
    // Calculate cumulative days for date calculation
    let cumulativeDays = 0;
    
    routeOrder.forEach((cityIndex, position) => {
        const city = cities[cityIndex];
        
        // Calculate arrival and departure dates
        const arrivalDate = new Date(startDate);
        arrivalDate.setDate(arrivalDate.getDate() + cumulativeDays);
        const departureDate = new Date(arrivalDate);
        departureDate.setDate(departureDate.getDate() + city.days);
        
        const arrivalShort = formatShortDate(arrivalDate);
        const departureShort = formatShortDate(departureDate);
        
        // Add City Node
        const country = getCountry(city);
        const countryDisplay = getCountryDisplay(country);
        const cityNode = document.createElement('div');
        cityNode.className = 'city-node draggable-city';
        cityNode.dataset.cityIndex = cityIndex;
        cityNode.innerHTML = `
            <div class="city-dot"></div>
            <div class="city-card" data-city-index="${cityIndex}">
                <div class="city-name">${city.name}</div>
                <div class="city-info">
                    <span class="city-days">${city.days} jour${city.days > 1 ? 's' : ''}</span>
                    <span class="city-dates">${arrivalShort} &ndash; ${departureShort}</span>
                    <span class="city-country">${countryDisplay.flag} ${countryDisplay.country}</span>
                </div>
                <div class="city-card-buttons">
                    <button class="city-card-btn city-card-btn-edit" title="Modifier">Modifier</button>
                    <button class="city-card-btn city-card-btn-details" title="Voir d&#233;tails">D&#233;tails</button>
                </div>
            </div>
            <div class="city-edit-panel" id="cityEditPanel-${cityIndex}" style="display: none;">
                <div class="edit-panel-header">
                    <span class="edit-panel-title">Modifier: <span id="cityNameDisplay-${cityIndex}">${city.name}</span></span>
                    <button class="delete-btn" onclick="window.deleteCityFromPanel(${cityIndex})" title="Supprimer">×</button>
                </div>
                <div class="edit-panel-content">
                    <div class="form-group">
                        <label for="nameInput-${cityIndex}">Nom de la ville:</label>
                        <input type="text" id="nameInput-${cityIndex}" value="${city.name}" placeholder="Nom de la ville">
                    </div>
                    <div class="form-group">
                        <label for="daysInput-${cityIndex}">Nombre de jours:</label>
                        <input type="number" id="daysInput-${cityIndex}" value="${city.days}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Dates:</label>
                        <span class="edit-panel-dates">${arrivalShort} - ${departureShort}</span>
                    </div>
                    <button class="update-days-btn" onclick="window.updateCityFromPanel(${cityIndex}, document.getElementById('nameInput-${cityIndex}').value, document.getElementById('daysInput-${cityIndex}').value)">
                        Mettre à jour
                    </button>
                </div>
            </div>
        `;
        timeline.appendChild(cityNode);
        
        // Add click handler to the edit button in the city card
        const editBtn = cityNode.querySelector('.city-card-btn-edit');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.closeAllPanels();
            window.closeCityDetails();
            const panel = document.getElementById(`cityEditPanel-${cityIndex}`);
            if (panel) {
                panel.style.display = 'block';
                window.currentOpenCityIndex = cityIndex;
            }
        });

        // Add click handler to the details button in the city card
        const detailsBtn = cityNode.querySelector('.city-card-btn-details');
        detailsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.closeAllPanels();
            window.openCityDetails(cityIndex);
        });
        
        // Add Trip Connector (except after last city)
        if (position < routeOrder.length - 1) {
            const nextCityIndex = routeOrder[position + 1];
            const nextCity = cities[nextCityIndex];
            const distance = calculateDistance(city.coords, nextCity.coords);
            const price = routePrices[position] || 0;
            const tripInfo = `${formatDistance(distance)} • €${price.toFixed(0)}`;
            
            // Update cumulative days for next city's arrival
            cumulativeDays += city.days;
            const formattedDate = formatDate(departureDate);
            const encodedDate = encodeURIComponent(formattedDate);
            
            const fromSlug = cityToSlug(city.name);
            const toSlug = cityToSlug(nextCity.name);
            const omioUrl = `https://www.omio.com/trains/${fromSlug}/${toSlug}?departure_date=${encodedDate}`;
            
            const tripConnector = document.createElement('div');
            tripConnector.className = 'trip-connector';
            tripConnector.dataset.tripIndex = position;
            tripConnector.innerHTML = `
                <a href="${omioUrl}" target="_blank" class="trip-info" title="Voir les billets de train sur Omio pour le ${formattedDate}">${tripInfo}</a>
                <button class="edit-trip-btn" onclick="toggleTripEdit(${position})" title="Modifier le prix">✏️</button>
            `;
            timeline.appendChild(tripConnector);
            
            // Create the edit panel separately and insert it after the connector
            const tripPanel = document.createElement('div');
            tripPanel.className = 'trip-edit-panel';
            tripPanel.id = `tripEditPanel-${position}`;
            tripPanel.style.display = 'none';
            tripPanel.innerHTML = `
                <span class="euro-symbol">€</span>
                <input type="text" id="priceInput-${position}" placeholder="0">
                <button class="update-days-btn" onclick="window.updateTripPriceFromPanel(${position}, document.getElementById('priceInput-${position}').value)">OK</button>
            `;
            timeline.appendChild(tripPanel);
        }
    });
    
    // Initialize drag and drop for timeline
    initTimelineSortable();
}

// Colors for route segments — warm, refined palette
const segmentColors = ['#c8a45c', '#b8936e', '#a8835a', '#c4a46e', '#d4b896', '#a09080', '#c0a870', '#b89070', '#c9a860', '#9e8a6a'];

// Geocode a city name using Nominatim (OpenStreetMap)
// This will automatically fetch coordinates when a city name is entered
function geocodeCity(city, inputElement) {
    const cityName = city.name.trim();
    if (!cityName) {
        // If city name is empty, set to [0, 0] as fallback
        city.coords = [0, 0];
        return;
    }
    
    // Show loading state on the input
    inputElement.style.opacity = '0.7';
    
    // Use Nominatim geocoding API
    // We add a small delay to avoid too many requests on rapid typing
    clearTimeout(city.geocodeTimeout);
    city.geocodeTimeout = setTimeout(() => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1&addressdetails=1`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        city.coords = [lat, lon];
                        // Trigger map redraw after a short delay
                        setTimeout(() => drawMap(), 100);
                    }
                }
            })
            .catch(error => {
                console.error('Geocoding error:', error);
            })
            .finally(() => {
                inputElement.style.opacity = '1';
            });
    }, 500);
}

// Initialize the map
function initMap() {
    map = L.map('map').setView([48.2082, 16.3738], 6);

    // Add the base map layer — dark refined CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Add legend
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = '<i></i> Itinéraire Interrail';
        return div;
    };
    legend.addTo(map);

    // Initialize the edit panel
    initEditPanel();

    // Draw the map with current data
    drawMap();
}

// Calculate and update trip statistics
function updateRecapPanel() {
    // Calculate total days
    const totalDays = routeOrder.reduce((sum, cityIndex) => sum + cities[cityIndex].days, 0);
    
    // Calculate number of cities
    const totalCities = routeOrder.length;
    
    // Calculate number of trips (legs between cities)
    const totalTrips = Math.max(0, routeOrder.length - 1);
    
    // Calculate average days per city
    const avgDays = totalCities > 0 ? (totalDays / totalCities).toFixed(1) : 0;
    
    // Calculate average price per trip
    const validPrices = routePrices.filter(price => price > 0);
    const avgPrice = validPrices.length > 0 ? (validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length).toFixed(1) : 0;
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < routeOrder.length - 1; i++) {
        const start = routeOrder[i];
        const end = routeOrder[i + 1];
        totalDistance += calculateDistance(cities[start].coords, cities[end].coords);
    }
    totalDistance = Math.round(totalDistance);
    
    // Update the DOM elements
    document.getElementById('totalDays').textContent = totalDays;
    document.getElementById('totalCities').textContent = totalCities;
    document.getElementById('totalTrips').textContent = totalTrips;
    document.getElementById('avgDays').textContent = avgDays;
    document.getElementById('avgPrice').textContent = avgPrice;
    
    // Update total distance if element exists
    const totalDistanceEl = document.getElementById('totalDistance');
    if (totalDistanceEl) {
        totalDistanceEl.textContent = totalDistance;
    }
}

// Draw or redraw the map with current cities and route
function drawMap() {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Clear existing polylines
    polylines.forEach(polyline => map.removeLayer(polyline));
    polylines = [];

    // Add markers for each city
    cities.forEach((city) => {
        const marker = L.marker(city.coords).addTo(map)
            .bindPopup(city.description + `<br><br><strong>Jours:</strong> ${city.days}`);
        markers.push(marker);
    });

    // Draw route lines
    for (let i = 0; i < routeOrder.length - 1; i++) {
        const start = routeOrder[i];
        const end = routeOrder[i + 1];
        const colorIndex = i % segmentColors.length;
        
        const polyline = L.polyline([cities[start].coords, cities[end].coords], {
            color: segmentColors[colorIndex],
            weight: 4,
            opacity: 0.9
        }).addTo(map);
        
        polylines.push(polyline);
    }

    // Fit map to all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.5));
    }

    // Update the recap and timeline
    updateRecapPanel();
    renderTimeline();

    saveToStorage();
}

// Export itinerary to JSON and download
function exportItinerary() {
    const data = {
        cities: cities,
        routeOrder: routeOrder,
        routePrices: routePrices,
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `itineraire-interrail-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Itinéraire exporté avec succès !');
}

// Import itinerary from JSON file
function importItinerary(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate the import data
            if (data.cities && data.routeOrder) {
                cities = data.cities;
                routeOrder = data.routeOrder;
                routePrices = data.routePrices || [];
                
                // Ensure all cities have the required properties
                cities.forEach(city => {
                    if (!city.days) city.days = 1;
                    if (!city.description) city.description = '';
                    if (!city.coords) city.coords = [0, 0];
                    if (city.details === undefined) city.details = '';
                });
                
                // Ensure routeOrder references valid indices
                routeOrder = routeOrder.filter(index => index >= 0 && index < cities.length);
                
                // Ensure routePrices has correct length
                while (routePrices.length < routeOrder.length - 1) {
                    routePrices.push(0);
                }
                
                // Geocode any cities without coordinates
                const geocodePromises = [];
                cities.forEach(city => {
                    if (city.coords[0] === 0 && city.coords[1] === 0 && city.name.trim()) {
                        geocodePromises.push(
                            new Promise(resolve => {
                                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city.name.trim())}&limit=1`;
                                fetch(url)
                                    .then(response => response.json())
                                    .then(data => {
                                        if (data && data.length > 0) {
                                            city.coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                                        }
                                        resolve();
                                    })
                                    .catch(() => resolve());
                            })
                        );
                    }
                });
                
                if (geocodePromises.length > 0) {
                    Promise.all(geocodePromises).then(() => drawMap());
                } else {
                    drawMap();
                }
                alert(`Itinéraire importé avec succès ! ${cities.length} villes chargées.`);
            } else {
                alert('Fichier JSON invalide : doit contenir "cities" et "routeOrder".');
            }
        } catch (error) {
            alert('Erreur lors de l\'import : fichier JSON invalide.\n' + error.message);
        }
    };
    reader.readAsText(file);
    
    // Reset the input so the same file can be imported again
    event.target.value = '';
}

// Initialize the edit panel functionality
function initEditPanel() {
    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportItinerary);

    // Import button
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    // Import file input change handler
    document.getElementById('importFile').addEventListener('change', importItinerary);

    // Initial render
    updateRecapPanel();
    renderTimeline();
}

// Initialize SortableJS for drag-and-drop reordering in timeline
function initTimelineSortable() {
    const timeline = document.getElementById('itineraryTimeline');
    if (!timeline) return;
    
    // Destroy existing Sortable if it exists
    if (window.timelineSortable) {
        window.timelineSortable.destroy();
    }
    
    window.timelineSortable = new Sortable(timeline, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        filter: '.trip-connector, .city-edit-panel',
        preventOnFilter: false,
        onStart: function(evt) {
            // Close any open panels when starting to drag
            window.closeAllPanels();
        },
        onEnd: function(evt) {
            // Build a map of existing prices by city pair
            const priceMap = {};
            for (let i = 0; i < routeOrder.length - 1; i++) {
                const from = routeOrder[i];
                const to = routeOrder[i + 1];
                priceMap[`${from}-${to}`] = routePrices[i];
            }
            
            // Rebuild routeOrder from DOM - only city nodes, not connectors
            const cityNodes = timeline.querySelectorAll('.city-node');
            const newRouteOrder = [];
            cityNodes.forEach(node => {
                newRouteOrder.push(parseInt(node.dataset.cityIndex));
            });
            routeOrder = newRouteOrder;
            
            // Rebuild routePrices, preserving prices where city pairs match
            const newPrices = [];
            for (let i = 0; i < routeOrder.length - 1; i++) {
                const from = routeOrder[i];
                const to = routeOrder[i + 1];
                // Try both directions (A-B and B-A)
                newPrices.push(priceMap[`${from}-${to}`] || priceMap[`${to}-${from}`] || 0);
            }
            routePrices = newPrices;
            
            // Redraw the timeline and update everything
            renderTimeline();
            updateRecapPanel();
            drawMap();
        }
    });
}

// Close edit panels when clicking outside
window.addEventListener('click', (e) => {
    const cityPanels = document.querySelectorAll('.city-edit-panel');
    const tripPanels = document.querySelectorAll('.trip-edit-panel');
    const allPanels = [...cityPanels, ...tripPanels];
    const isClickInsidePanel = allPanels.some(panel => panel.contains(e.target));
    const isClickOnCityCard = Array.from(document.querySelectorAll('.city-card')).some(card => card.contains(e.target));
    const isClickOnEditBtn = Array.from(document.querySelectorAll('.edit-trip-btn')).some(btn => btn.contains(e.target));
    const isClickOnInput = e.target.tagName === 'INPUT';
    const isClickOnButton = e.target.tagName === 'BUTTON';
    
    if (!isClickInsidePanel && !isClickOnCityCard && !isClickOnEditBtn && !isClickOnInput && !isClickOnButton) {
        window.closeAllPanels();
    }
});

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    startBgAnimation();

    const loaded = loadFromStorage();

    const startDateInput = document.getElementById('startDate');
    if (startDateInput) {
        if (loaded) {
            startDateInput.value = startDate.toISOString().split('T')[0];
        }
        startDateInput.addEventListener('change', (e) => {
            startDate = new Date(e.target.value);
            saveToStorage();
            renderTimeline();
        });
        if (startDateInput.value) {
            startDate = new Date(startDateInput.value);
        }
    }
    initMap();
});

window.addEventListener('resize', () => {
    drawBackgroundPattern();
});

let bgAnimFrame;
let bgDashOffset = 0;

function startBgAnimation() {
    cancelAnimationFrame(bgAnimFrame);
    function tick() {
        bgDashOffset += 0.4;
        drawBackgroundPattern();
        bgAnimFrame = requestAnimationFrame(tick);
    }
    tick();
}

function drawBackgroundPattern() {
    const canvas = document.querySelector('.bg-pattern');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.scale(dpr, dpr);

    const accentColor = '#c8a45c';

    function seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }
    const rand = seededRandom(42);

    const spacing = 200;
    const gridCols = Math.ceil(w / spacing) + 2;
    const gridRows = Math.ceil(h / spacing) + 2;

    const nodes = [];

    for (let gy = -1; gy < gridRows; gy++) {
        for (let gx = -1; gx < gridCols; gx++) {
            const bx = gx * spacing;
            const by = gy * spacing;
            const nx = bx + spacing * 0.1 + rand() * spacing * 0.8;
            const ny = by + spacing * 0.1 + rand() * spacing * 0.8;
            nodes.push({
                x: nx, y: ny,
                r: 1.6 + rand() * 3.2,
                a: 0.16 + rand() * 0.28,
                shape: Math.floor(rand() * 4),
                rotation: rand() * Math.PI * 2
            });
        }
    }

    const edges = [];
    const maxDist = spacing * 1.35;

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist && dist > spacing * 0.3) {
                edges.push({ a: i, b: j, dist: dist });
            }
        }
    }

    edges.sort((a, b) => a.dist - b.dist);

    const parent = new Array(nodes.length).fill(null).map((_, i) => i);
    function findRoot(v) {
        while (parent[v] !== v) {
            parent[v] = parent[parent[v]];
            v = parent[v];
        }
        return v;
    }

    const trunkEdges = [];
    for (const e of edges) {
        const ra = findRoot(e.a);
        const rb = findRoot(e.b);
        if (ra !== rb) {
            parent[ra] = rb;
            trunkEdges.push(e);
        }
    }

    const extraEdges = [];
    for (const e of edges) {
        if (!trunkEdges.some(te => te.a === e.a && te.b === e.b) && rand() < 0.22) {
            extraEdges.push(e);
        }
    }

    const allEdges = [...trunkEdges, ...extraEdges];

    const trunkSet = new Set(trunkEdges.map(e => `${e.a}-${e.b}`));
    const trunkAlphaBase = 0.22;
    const branchAlphaBase = 0.13;

    let ticker = 0;
    allEdges.forEach(e => {
        const isTrunk = trunkSet.has(`${e.a}-${e.b}`);
        ticker++;
        const dashLen = isTrunk ? 7 + rand() * 10 : 5 + rand() * 8;
        const gapLen = isTrunk ? 5 + rand() * 6 : 6 + rand() * 8;
        const sw = isTrunk ? 0.9 + rand() * 1.0 : 0.5 + rand() * 0.5;
        const alpha = isTrunk ? trunkAlphaBase + rand() * 0.20 : branchAlphaBase + rand() * 0.14;
        const speed = isTrunk ? 1.0 + rand() * 1.5 : 2.0 + rand() * 2.5;

        const from = nodes[e.a];
        const to = nodes[e.b];
        const mx = (from.x + to.x) / 2 + (rand() - 0.5) * 60;
        const my = (from.y + to.y) / 2 + (rand() - 0.5) * 60;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(mx, my, to.x, to.y);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = sw;
        ctx.globalAlpha = alpha;
        ctx.setLineDash([dashLen, gapLen]);
        ctx.lineDashOffset = bgDashOffset * speed;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
    });

    nodes.forEach(node => {
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = node.a;

        switch (node.shape) {
            case 0: // Circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 1: // Diamond
                ctx.beginPath();
                ctx.moveTo(node.x, node.y - node.r);
                ctx.lineTo(node.x + node.r, node.y);
                ctx.lineTo(node.x, node.y + node.r);
                ctx.lineTo(node.x - node.r, node.y);
                ctx.closePath();
                ctx.fill();
                break;
            case 2: // Triangle
                ctx.beginPath();
                for (let i = 0; i < 3; i++) {
                    const angle = node.rotation + (i * Math.PI * 2) / 3;
                    const px = node.x + Math.cos(angle) * node.r;
                    const py = node.y + Math.sin(angle) * node.r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                break;
            case 3: // Cross / plus
                {
                    const s = node.r * 0.35;
                    ctx.fillRect(node.x - s, node.y - node.r, s * 2, node.r * 2);
                    ctx.fillRect(node.x - node.r, node.y - s, node.r * 2, s * 2);
                }
                break;
        }
        ctx.globalAlpha = 1;
    });
}
