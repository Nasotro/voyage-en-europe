// Coordonnées des villes (latitude, longitude)
let cities = [
    {
        name: "Paris",
        coords: [48.8566, 2.3522],
        description: "<b>Paris, France</b><br>Tour Eiffel, Musée du Louvre, Notre-Dame, Montmartre",
        days: 3
    },
    {
        name: "Vienne",
        coords: [48.2082, 16.3738],
        description: "<b>Vienne, Autriche</b><br>Palais de Schönbrunn, Opéra, Café Central",
        days: 2
    },
    {
        name: "Prague",
        coords: [50.0755, 14.4378],
        description: "<b>Prague, République Tchèque</b><br>Pont Charles, Château de Prague",
        days: 2
    },
    {
        name: "Budapest",
        coords: [47.4979, 19.0402],
        description: "<b>Budapest, Hongrie</b><br>Parlement, Bains Széchenyi",
        days: 2
    },
    {
        name: "Bratislava",
        coords: [48.1486, 17.1077],
        description: "<b>Bratislava, Slovaquie</b><br>Château, Vieille Ville",
        days: 1
    },
    {
        name: "Munich",
        coords: [48.1351, 11.5820],
        description: "<b>Munich, Allemagne</b><br>Marienplatz, Englischer Garten",
        days: 2
    },
    {
        name: "Salzbourg",
        coords: [47.8095, 13.0550],
        description: "<b>Salzbourg, Autriche</b><br>Forteresse de Hohensalzburg, Maison de Mozart",
        days: 2
    },
    {
        name: "Paris",
        coords: [48.8566, 2.3522],
        description: "<b>Paris, France</b><br>Tour Eiffel, Musée du Louvre, Notre-Dame, Montmartre",
        days: 2
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

// Render the vertical timeline with cities and trips
function renderTimeline() {
    const timeline = document.getElementById('itineraryTimeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    
    routeOrder.forEach((cityIndex, position) => {
        const city = cities[cityIndex];
        
        // Add City Stop
        const cityItem = document.createElement('div');
        cityItem.className = 'timeline-item city';
        cityItem.innerHTML = `
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-title">${city.name}</span>
                </div>
                <div class="timeline-details">
                    <div class="timeline-detail city-days">
                        <i>📅</i> ${city.days} jour${city.days > 1 ? 's' : ''}
                    </div>
                    <div class="timeline-detail">
                        <i>📍</i> ${city.coords[0].toFixed(4)}, ${city.coords[1].toFixed(4)}
                    </div>
                </div>
            </div>
        `;
        timeline.appendChild(cityItem);
        
        // Add Trip Segment (except after last city)
        if (position < routeOrder.length - 1) {
            const nextCityIndex = routeOrder[position + 1];
            const nextCity = cities[nextCityIndex];
            const distance = calculateDistance(city.coords, nextCity.coords);
            const price = routePrices[position] || 0;
            
            const tripItem = document.createElement('div');
            tripItem.className = 'timeline-item trip';
            tripItem.innerHTML = `
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-title">➡️ ${city.name} → ${nextCity.name}</span>
                    </div>
                    <div class="timeline-details">
                        <div class="timeline-detail trip-distance">
                            <i>📏</i> ${formatDistance(distance)}
                        </div>
                        <div class="timeline-detail trip-price">
                            <i>💰</i> €${price.toFixed(2)}
                        </div>
                    </div>
                </div>
            `;
            timeline.appendChild(tripItem);
        }
    });
}

// Colors for route segments
const segmentColors = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#1abc9c', '#e67e22', '#34495e'];

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

    // Add the base map layer
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team'
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
    
    // Update the DOM elements
    document.getElementById('totalDays').textContent = totalDays;
    document.getElementById('totalCities').textContent = totalCities;
    document.getElementById('totalTrips').textContent = totalTrips;
    document.getElementById('avgDays').textContent = avgDays;
    document.getElementById('avgPrice').textContent = avgPrice;
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

    // Update the edit panel, recap, and timeline
    renderCitiesTable();
    updateRecapPanel();
    renderTimeline();
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
    // Add city button
    document.getElementById('addCityBtn').addEventListener('click', () => {
        const newCity = {
            name: 'Nouvelle Ville',
            coords: [0, 0],
            description: '',
            days: 1
        };
        cities.push(newCity);
        routeOrder.push(cities.length - 1);
        routePrices.push(0);
        drawMap();
        
        // Focus on the new city's name input so user can rename it immediately
        setTimeout(() => {
            const inputs = document.querySelectorAll('#citiesList input[type="text"]');
            if (inputs.length > 0) {
                inputs[inputs.length - 1].focus();
            }
        }, 100);
    });

    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => {
        // Geocode any cities that don't have coordinates yet
        const geocodePromises = [];
        cities.forEach(city => {
            if (!city.coords || (city.coords[0] === 0 && city.coords[1] === 0)) {
                geocodePromises.push(
                    new Promise(resolve => {
                        const cityName = city.name.trim();
                        if (cityName) {
                            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`;
                            fetch(url)
                                .then(response => response.json())
                                .then(data => {
                                    if (data && data.length > 0) {
                                        city.coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                                    }
                                    resolve();
                                })
                                .catch(() => resolve());
                        } else {
                            city.coords = [0, 0];
                            resolve();
                        }
                    })
                );
            }
        });
        
        // If there are cities to geocode, wait for them all to finish
        if (geocodePromises.length > 0) {
            Promise.all(geocodePromises).then(() => {
                drawMap();
                alert('Itinéraire sauvegardé et carte mise à jour !');
            });
        } else {
            drawMap();
            alert('Itinéraire sauvegardé et carte mise à jour !');
        }
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportItinerary);

    // Import button
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    // Import file input change handler
    document.getElementById('importFile').addEventListener('change', importItinerary);

    // Initial render
    renderCitiesTable();
    updateRecapPanel();
}

// Render the cities table in the edit panel
function renderCitiesTable() {
    const tbody = document.getElementById('citiesList');
    tbody.innerHTML = '';

    routeOrder.forEach((cityIndex, position) => {
        const city = cities[cityIndex];
        const row = document.createElement('tr');
        row.className = 'city-row';
        row.dataset.index = position;

        // Order cell
        const orderCell = document.createElement('td');
        orderCell.textContent = position + 1;
        row.appendChild(orderCell);

        // City name cell
        const nameCell = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = city.name;
        nameInput.addEventListener('change', (e) => {
            city.name = e.target.value;
            // Auto-geocode when city name changes
            geocodeCity(city, nameInput);
        });
        nameCell.appendChild(nameInput);
        row.appendChild(nameCell);

        // Days cell
        const daysCell = document.createElement('td');
        const daysInput = document.createElement('input');
        daysInput.type = 'number';
        daysInput.value = city.days;
        daysInput.min = '1';
        daysInput.addEventListener('change', (e) => {
            city.days = parseInt(e.target.value) || 1;
            updateRecapPanel();
        });
        daysCell.appendChild(daysInput);
        row.appendChild(daysCell);

        // Price cell (price from this city to the next)
        const priceCell = document.createElement('td');
        if (position < routeOrder.length - 1) {
            const priceContainer = document.createElement('div');
            priceContainer.style.display = 'flex';
            priceContainer.style.gap = '5px';
            priceContainer.style.alignItems = 'center';
            
            const priceInput = document.createElement('input');
            priceInput.type = 'number';
            priceInput.value = routePrices[position] || 0;
            priceInput.min = '0';
            priceInput.placeholder = '0';
            priceInput.style.width = '70px';
            priceInput.addEventListener('change', (e) => {
                routePrices[position] = parseFloat(e.target.value) || 0;
                updateRecapPanel();
            });
            priceContainer.appendChild(priceInput);
            
            // Add Find Price button
            const findPriceBtn = document.createElement('button');
            findPriceBtn.className = 'find-price-btn';
            findPriceBtn.textContent = '🔍';
            findPriceBtn.title = 'Trouver le prix en ligne';
            findPriceBtn.style.padding = '3px 6px';
            findPriceBtn.style.fontSize = '12px';
            findPriceBtn.style.cursor = 'pointer';
            findPriceBtn.addEventListener('click', () => {
                const fromCity = cities[routeOrder[position]].name;
                const toCity = cities[routeOrder[position + 1]].name;
                const fromSlug = cityToSlug(fromCity);
                const toSlug = cityToSlug(toCity);
                window.open(`https://www.omio.com/trains/${fromSlug}/${toSlug}`, '_blank');
            });
            priceContainer.appendChild(findPriceBtn);
            
            priceCell.appendChild(priceContainer);
        } else {
            priceCell.textContent = '-';
        }
        row.appendChild(priceCell);

        // Actions cell
        const actionsCell = document.createElement('td');
        
        // Move up button
        const moveUpBtn = document.createElement('button');
        moveUpBtn.className = 'move-btn';
        moveUpBtn.textContent = '↑';
        moveUpBtn.title = 'Monter';
        moveUpBtn.disabled = position === 0;
        moveUpBtn.addEventListener('click', () => {
            if (position > 0) {
                // Swap with previous in routeOrder
                const temp = routeOrder[position];
                routeOrder[position] = routeOrder[position - 1];
                routeOrder[position - 1] = temp;
                
                // Swap corresponding prices if they exist
                if (position - 1 < routePrices.length && position < routePrices.length) {
                    const tempPrice = routePrices[position - 1];
                    routePrices[position - 1] = routePrices[position];
                    routePrices[position] = tempPrice;
                }
                
                drawMap();
            }
        });
        actionsCell.appendChild(moveUpBtn);

        // Move down button
        const moveDownBtn = document.createElement('button');
        moveDownBtn.className = 'move-btn';
        moveDownBtn.textContent = '↓';
        moveDownBtn.title = 'Descendre';
        moveDownBtn.disabled = position === routeOrder.length - 1;
        moveDownBtn.addEventListener('click', () => {
            if (position < routeOrder.length - 1) {
                // Swap with next in routeOrder
                const temp = routeOrder[position];
                routeOrder[position] = routeOrder[position + 1];
                routeOrder[position + 1] = temp;
                
                // Swap corresponding prices if they exist
                if (position < routePrices.length && position + 1 < routePrices.length) {
                    const tempPrice = routePrices[position];
                    routePrices[position] = routePrices[position + 1];
                    routePrices[position + 1] = tempPrice;
                }
                
                drawMap();
            }
        });
        actionsCell.appendChild(moveDownBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Supprimer';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Supprimer ${city.name} de l'itinéraire?`)) {
                // Remove from routeOrder
                routeOrder.splice(position, 1);
                // Remove corresponding price (if this is not the last city)
                if (position < routePrices.length) {
                    routePrices.splice(position, 1);
                }
                drawMap();
            }
        });
        actionsCell.appendChild(deleteBtn);

        row.appendChild(actionsCell);
        tbody.appendChild(row);
    });
    
    // Update recap after rendering
    updateRecapPanel();
}

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', initMap);
