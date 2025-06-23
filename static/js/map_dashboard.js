// static/js/map_dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('Map Dashboard loaded successfully.');

    // Mapbox Access Token will be fetched from backend
    let mapboxAccessToken = '';

    const userMenuButton = document.getElementById('user-menu-button');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    const userDisplayName = document.getElementById('user-display-name');
    const userEmailDisplay = document.getElementById('user-email-display');
    const logoutButton = document.getElementById('logout-button');
    const settingsButton = document.getElementById('settings-button');

    // Modal elements
    const settingsModal = document.getElementById('settings-modal');
    const modalContentBox = document.getElementById('modal-content-box'); // Get the inner content box
    const closeSettingsModalButton = document.getElementById('close-settings-modal');
    const mapSettingsForm = document.getElementById('map-settings-form');
    const modalZoomLevelInput = document.getElementById('modal-zoom-level');
    const modalLatitudeInput = document.getElementById('modal-latitude');
    const modalLongitudeInput = document.getElementById('modal-longitude');
    const modalMessageBox = document.getElementById('modal-message-box');

    // Elements for address search and pick on map
    const addressInput = document.getElementById('address-search-input');
    const searchAddressButton = document.getElementById('search-address-button');
    const searchResultsDropdown = document.getElementById('search-results-dropdown');
    const pickOnMapButton = document.getElementById('pick-on-map-button');

    // Main message box (can be used for general page messages outside modal)
    const pageMessageBox = document.getElementById('messageBox');

    // State variable to track if map picking mode is active
    let isPickingLocation = false;


    // --- Session Timeout Configuration ---
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 1 minutes in milliseconds (adjust as needed)
    let timeoutId; // Variable to hold our timeout ID

    // Function to display messages in the custom message box
    function showMessage(message, type = 'info', targetBox = pageMessageBox) {
        targetBox.textContent = message;
        // Reset classes to ensure proper styling from scratch
        targetBox.className = `mt-6 p-4 rounded-lg text-sm text-center font-medium ${type}`;

        // For the main page message box, apply fixed positioning
        if (targetBox === pageMessageBox) {
            targetBox.classList.add('fixed', 'bottom-4', 'left-1/2', '-translate-x-1/2', 'z-50');
        } else {
            // For modal message box, ensure it's not fixed if it was initially
            targetBox.classList.remove('fixed', 'bottom-4', 'left-1/2', '-translate-x-1/2', 'z-50');
        }
        targetBox.classList.remove('hidden'); // Make it visible

        // Automatically hide the message after 5 seconds
        setTimeout(() => {
            hideMessageBox(targetBox);
        }, 5000);
    }

    // Function to hide the message box
    function hideMessageBox(targetBox) {
        if (targetBox) { // Ensure targetBox is provided
            targetBox.classList.add('hidden');
            targetBox.textContent = '';
            targetBox.className = 'hidden'; // Reset class for next message
        }
    }

    // Function to reset the inactivity timer
    function resetInactivityTimer() {
        clearTimeout(timeoutId); // Clear any existing timer
        timeoutId = setTimeout(logoutUser, INACTIVITY_TIMEOUT); // Set a new timer
    }

    // Function to log out the user when inactivity timeout occurs
    function logoutUser() {
        console.warn('Session timed out due to inactivity. Logging out...');
        localStorage.removeItem('authToken'); // Clear the stored JWT token
        window.location.href = '/templates/login.html'; // Redirect to login page
    }

    // --- User Dropdown Logic ---
    userMenuButton.addEventListener('click', () => {
        userMenuDropdown.classList.toggle('hidden');
    });

    // Close the dropdown if clicked outside
    window.addEventListener('click', (event) => {
        if (!userMenuButton.contains(event.target) && !userMenuDropdown.contains(event.target)) {
            userMenuDropdown.classList.add('hidden');
        }
    });

    // --- Logout Logic ---
    logoutButton.addEventListener('click', () => {
        clearTimeout(timeoutId); // Clear timer immediately on manual logout
        localStorage.removeItem('authToken'); // Clear the stored JWT token
        window.location.href = '/templates/login.html'; // Redirect to login page
    });

    // --- Map Settings Modal Logic ---
    settingsButton.addEventListener('click', async (event) => {
        event.preventDefault(); // Prevent default link behavior
        userMenuDropdown.classList.add('hidden'); // Hide dropdown when modal opens

        // No 'settings-modal-left' class manipulation is needed anymore for positioning
        isPickingLocation = false;
        searchResultsDropdown.classList.add('hidden'); // Hide search results
        searchResultsDropdown.innerHTML = ''; // Clear results

        // Fetch user data again to populate the modal with current map settings
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            showMessage('Session expired. Please log in again.', 'error', pageMessageBox);
            setTimeout(() => { window.location.href = '/templates/login.html'; }, 2000);
            return;
        }

        try {
            const response = await fetch('/api/v1/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                // Use default values if data is null from backend, and apply rounding
                modalZoomLevelInput.value = userData.map_zoom_level !== null ? parseInt(userData.map_zoom_level) : 12; // Whole number for zoom
                modalLatitudeInput.value = userData.map_latitude !== null ? parseFloat(userData.map_latitude).toFixed(4) : 51.5050; // Rounded to 4 decimal places
                modalLongitudeInput.value = userData.map_longitude !== null ? parseFloat(userData.map_longitude).toFixed(4) : -0.0900; // Rounded to 4 decimal places
                settingsModal.classList.remove('hidden'); // Show the modal
            } else if (response.status === 401) {
                showMessage('Unauthorized. Please log in again.', 'error', pageMessageBox);
                localStorage.removeItem('authToken');
                setTimeout(() => { window.location.href = '/templates/login.html'; }, 2000);
            } else {
                // Attempt to parse error as JSON, but fallback to text if it fails
                let errorDetail = response.statusText;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                    console.error("Error parsing response as JSON:", e, response.statusText);
                    // If JSON parsing fails, errorDetail remains statusText
                }
                showMessage(`Failed to load settings: ${errorDetail}`, 'error', modalMessageBox);
            }
        } catch (error) {
            console.error('Network error fetching user map settings for modal:', error);
            showMessage('Network error while loading settings.', 'error', modalMessageBox);
        }
    });

    closeSettingsModalButton.addEventListener('click', () => {
        settingsModal.classList.add('hidden'); // Hide the modal
        hideMessageBox(modalMessageBox); // Clear any modal messages
        searchResultsDropdown.classList.add('hidden'); // Hide search results
        searchResultsDropdown.innerHTML = ''; // Clear results
        isPickingLocation = false; // Disable picking mode when closing modal
    });

    // Handle form submission for map settings
    mapSettingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideMessageBox(modalMessageBox); // Clear previous messages

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            showMessage('Session expired. Please log in again.', 'error', modalMessageBox);
            setTimeout(() => { window.location.href = '/templates/login.html'; }, 2000);
            return;
        }

        // Validate inputs before sending
        const zoom = parseFloat(modalZoomLevelInput.value);
        const lat = parseFloat(modalLatitudeInput.value);
        const lon = parseFloat(modalLongitudeInput.value);

        if (isNaN(zoom) || zoom < 0 || zoom > 22) {
            showMessage('Please enter a valid zoom level (0-22).', 'error', modalMessageBox);
            return;
        }
        if (isNaN(lat) || lat < -90 || lat > 90) {
            showMessage('Please enter a valid latitude (-90 to 90).', 'error', modalMessageBox);
            return;
        }
        if (isNaN(lon) || lon < -180 || lon > 180) {
            showMessage('Please enter a valid longitude (-180 to 180).', 'error', modalMessageBox);
            return;
        }

        const updatedSettings = {
            map_zoom_level: zoom,
            map_latitude: lat,
            map_longitude: lon
        };

        try {
            const response = await fetch('/api/v1/users/me/map-settings', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedSettings)
            });

            if (response.ok) {
                const updatedUserData = await response.json();
                // showMessage('Map settings updated successfully!', 'success', modalMessageBox);
                // Update the map immediately with new settings
                map.flyTo({
                    center: [updatedUserData.map_longitude, updatedUserData.map_latitude],
                    zoom: updatedUserData.map_zoom_level,
                    essential: true
                });
                // Close modal after successful update
                setTimeout(() => {
                    settingsModal.classList.add('hidden');
                    hideMessageBox(modalMessageBox);
                    searchResultsDropdown.classList.add('hidden');
                    searchResultsDropdown.innerHTML = '';
                    isPickingLocation = false;
                }, 1500);
            } else if (response.status === 401) {
                showMessage('Unauthorized. Please log in again.', 'error', modalMessageBox);
                localStorage.removeItem('authToken');
                setTimeout(() => { window.location.href = '/templates/login.html'; }, 2000);
            } else {
                // Try to parse JSON, but if it fails, use raw text from response
                let errorDetail = response.statusText;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                    console.error("Error parsing backend error response as JSON:", e);
                    // If parsing fails, attempt to read response as text to get raw error
                    errorDetail = await response.text();
                }
                showMessage(`Failed to update settings: ${errorDetail}`, 'error', modalMessageBox);
            }
        } catch (error) {
            console.error('Network error updating map settings:', error);
            showMessage('Network error while saving settings. Please check your connection.', 'error', modalMessageBox);
        }
    });


    // --- Mapbox GL JS Initialization ---
    let map;
    let marker;

    async function initializeMapWithUserData() {
        // Fetch Mapbox token from the backend
        try {
            const tokenResponse = await fetch('/api/v1/users/mapbox-token');
            if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                mapboxAccessToken = tokenData.token;
                mapboxgl.accessToken = mapboxAccessToken; // Set Mapbox access token
            } else {
                let errorDetail = tokenResponse.statusText;
                try {
                    const errorJson = await tokenResponse.json();
                    errorDetail = errorJson.detail || errorDetail;
                } catch (e) {
                    console.error("Error parsing Mapbox token response JSON:", e);
                }
                console.error('Failed to fetch Mapbox token:', errorDetail);
                showMessage('Map initialization failed: Could not get Mapbox token.', 'error', pageMessageBox);
                return;
            }
        } catch (error) {
            console.error('Network error fetching Mapbox token:', error);
            showMessage('Map initialization failed: Network error fetching token.', 'error', pageMessageBox);
            return;
        }

        const authToken = localStorage.getItem('authToken');
        let initialZoom = 12;
        let initialCenter = [-0.09, 51.505]; // Default to London

        if (!authToken) {
            console.warn('No auth token found. Redirecting to login.');
            window.location.href = '/templates/login.html';
            return;
        }

        try {
            const response = await fetch('/api/v1/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                console.log('Successfully fetched user data:', userData);
                userDisplayName.textContent = userData.username || userData.email || 'User';
                userEmailDisplay.textContent = userData.email || 'No Email';

                // Ensure initial values are correctly formatted
                initialZoom = userData.map_zoom_level !== null && userData.map_zoom_level !== undefined ? parseInt(userData.map_zoom_level) : 12;
                initialCenter = [
                    userData.map_longitude !== null && userData.map_longitude !== undefined ? parseFloat(userData.map_longitude) : -0.09,
                    userData.map_latitude !== null && userData.map_latitude !== undefined ? parseFloat(userData.map_latitude) : 51.505
                ];
                resetInactivityTimer();
            } else if (response.status === 401) {
                console.error('Unauthorized: Invalid or expired token. Redirecting to login.');
                localStorage.removeItem('authToken');
                window.location.href = '/templates/login.html';
                return;
            } else {
                let errorDetail = response.statusText;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                    console.error("Error parsing response as JSON:", e);
                }
                console.error('Failed to fetch initial user data for map:', errorDetail);
            }
        } catch (error) {
            console.error('Network error fetching initial user data for map:', error);
        }        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: initialCenter,
            zoom: initialZoom,
            minZoom: 0,
            maxZoom: 19,
            attributionControl: false, // Explicitly disable attribution control
            hash: true // Enable hash in URL for easy sharing
        });

        // Initialize geocoding search
        initGeocoding();

        marker = new mapboxgl.Marker()
            .setLngLat(initialCenter)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML("<h3>Your Last Saved Location</h3><p>This is where your map was centered.</p>"))
            .addTo(map);

        console.log('Map initialized with Mapbox GL JS and user data.');

        const zoomInButton = document.getElementById('zoom-in');
        const zoomOutButton = document.getElementById('zoom-out');
        const resetCompassButton = document.getElementById('reset-compass');

        zoomInButton.addEventListener('click', () => {
            map.zoomIn();
        });

        zoomOutButton.addEventListener('click', () => {
            map.zoomOut();
        });

        resetCompassButton.addEventListener('click', () => {
            map.resetNorth();
        });

        // --- Mapbox Geocoding Functionality (Address Search) ---
        addressInput.addEventListener('input', async () => {
            const address = addressInput.value.trim();
            if (address.length < 3) {
                searchResultsDropdown.classList.add('hidden');
                searchResultsDropdown.innerHTML = '';
                return;
            }

            // No class manipulation for modalContentBox translation needed here
            isPickingLocation = true; // Indicate that map interaction is expected for visual consistency

            try {
                searchResultsDropdown.innerHTML = '<li class="p-2 text-gray-600">Searching...</li>';
                searchResultsDropdown.classList.remove('hidden');

                const mapboxGeocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxAccessToken}&limit=5`;
                const response = await fetch(mapboxGeocodingUrl);
                const data = await response.json();

                if (data && data.features && data.features.length > 0) {
                    searchResultsDropdown.innerHTML = '';
                    data.features.forEach(feature => {
                        const listItem = document.createElement('li');
                        listItem.className = 'p-2 cursor-pointer hover:bg-gray-100 rounded-md text-gray-800';
                        listItem.textContent = feature.place_name;
                        listItem.addEventListener('click', () => {
                            const lat = parseFloat(feature.center[1]).toFixed(4); // Mapbox center is [lon, lat]
                            const lon = parseFloat(feature.center[0]).toFixed(4);
                            const zoomLevel = 14; // Fixed zoom for search results for consistency

                            modalLatitudeInput.value = lat;
                            modalLongitudeInput.value = lon;
                            modalZoomLevelInput.value = zoomLevel; // Set whole number zoom

                            // showMessage(`Selected: ${feature.place_name}`, 'success', modalMessageBox);

                            map.flyTo({ center: [lon, lat], zoom: zoomLevel, essential: true });
                            marker.setLngLat([lon, lat])
                                .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<h3>Searched Location</h3><p>${feature.place_name}</p>`))
                                .addTo(map);

                            searchResultsDropdown.classList.add('hidden');
                            isPickingLocation = false;
                            // No class manipulation for modalContentBox translation needed here
                        });
                        searchResultsDropdown.appendChild(listItem);
                    });
                } else {
                    searchResultsDropdown.innerHTML = '<li class="p-2 text-gray-600">No results found.</li>';
                    // showMessage('Address not found. Please try a different address.', 'error', modalMessageBox);
                }
            } catch (error) {
                console.error('Error during Mapbox geocoding:', error);
                // showMessage('Error searching address. Please try again later.', 'error', modalMessageBox);
                searchResultsDropdown.classList.add('hidden');
                isPickingLocation = false;
                // No class manipulation for modalContentBox translation needed here
            }
        });

        searchAddressButton.addEventListener('click', () => {
            addressInput.dispatchEvent(new Event('input'));
        });

        document.addEventListener('click', (event) => {
            if (!addressInput.contains(event.target) && !searchAddressButton.contains(event.target) && !searchResultsDropdown.contains(event.target)) {
                searchResultsDropdown.classList.add('hidden');
                searchResultsDropdown.innerHTML = '';
            }
        });

        pickOnMapButton.addEventListener('click', () => {
            // No class manipulation for modalContentBox translation needed here
            isPickingLocation = true; // Activate map interaction mode
            // showMessage('Click anywhere on the map to pick a location. Click "Save Settings" when done.', 'info', modalMessageBox);
            searchResultsDropdown.classList.add('hidden');
            searchResultsDropdown.innerHTML = '';
        });

        map.on('click', (e) => {
            if (isPickingLocation && !settingsModal.classList.contains('hidden')) {
                const clickedLngLat = e.lngLat;
                modalLatitudeInput.value = parseFloat(clickedLngLat.lat).toFixed(4);
                modalLongitudeInput.value = parseFloat(clickedLngLat.lng).toFixed(4);

                // showMessage(`Location picked! Lat: ${parseFloat(clickedLngLat.lat).toFixed(4)}, Lng: ${parseFloat(clickedLngLat.lng).toFixed(4)}`, 'success', modalMessageBox);

                marker.setLngLat([clickedLngLat.lng, clickedLngLat.lat])
                    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<h3>Pinned Location</h3><p>Lat: ${parseFloat(clickedLngLat.lat).toFixed(4)}<br>Lng: ${parseFloat(clickedLngLat.lng).toFixed(4)}</p>`))
                    .addTo(map);
            } else if (!settingsModal.classList.contains('hidden')) {
                // showMessage('Click "Pick Location on Map" to enable map selection.', 'info', modalMessageBox);
            }
        });


        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        } else {
            console.warn('Lucide Icons script not loaded or available.');
        }

        document.body.addEventListener('mousemove', resetInactivityTimer);
        document.body.addEventListener('keydown', resetInactivityTimer);
        document.body.addEventListener('click', resetInactivityTimer);
        document.body.addEventListener('scroll', resetInactivityTimer);
        resetInactivityTimer();
    }    initializeMapWithUserData();

    // --- Sidebar Toggle Group Logic ---
    const sidebar = document.getElementById('sidebar');
    const sidebarContent = document.getElementById('sidebar-content');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const styleSidebarToggle = document.getElementById('style-sidebar-toggle');
    const sidebarToggleGroup = document.getElementById('sidebar-toggle-group');

    let sidebarMode = null; // 'layers' or 'style'
    let layerList = []; // {name, visible}

    // Store fields for each layer
    let layerFields = {};
    // Store geometry type for each layer
    let layerGeometryTypes = {};

    // --- Remapping Functions for UI Display ---
    function remapSchemaName(schema) {
        if (!schema) return '';
        return schema.charAt(0).toUpperCase() + schema.slice(1).toLowerCase();
    }
    function remapTableName(table) {
        if (!table) return '';
        return table.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    function remapType(type) {
        if (!type) return '';
        return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }
    function remapFilterField(field) {
        if (!field) return '';
        return field.replace(/[^a-zA-Z0-9_]/g, '').replace(/_/g, ' ').toUpperCase();
    }

    // Helper to render the sidebar content based on mode
    function renderSidebar() {
        if (sidebarMode === 'layers') {
            sidebarContent.innerHTML = `
                <h2 class="text-lg font-semibold text-gray-800 mb-6">Layer Selection</h2>
                <div class="mb-4">
                    <label for="schema-select" class="block text-sm font-medium text-gray-700 mb-2">Select Schema</label>
                    <div class="relative">
                        <select id="schema-select" class="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer">
                            <option value="">Select a schema...</option>
                        </select>
                    </div>
                </div>
                <div class="mb-4">
                    <label for="table-select" class="block text-sm font-medium text-gray-700 mb-2">Select Table</label>
                    <div class="relative">
                        <select id="table-select" class="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed" disabled>
                            <option value="">Select a table...</option>
                        </select>
                    </div>
                </div>
                <div class="mb-4">
                    <label for="type-select" class="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <div class="relative">
                        <select id="type-select" class="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed" disabled>
                            <option value="">Select a type...</option>
                        </select>
                    </div>
                </div>
                <div class="mt-6 space-y-4">
                    <button id="add-layer-btn" class="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200" disabled>
                        <i data-lucide="plus-circle" class="w-4 h-4 mr-2"></i>
                        Add Layer
                    </button>
                    <div class="border-t pt-4">
                        <h3 class="text-sm font-medium text-gray-700 mb-2">Layer Group</h3>
                        <ul id="layer-list" class="space-y-2">
                            <!-- Layers will be rendered here -->
                        </ul>
                    </div>
                </div>
            `;
            populateSchemaDropdown();
            renderLayerList();
            // Setup dropdowns
            const schemaSelect = sidebarContent.querySelector('#schema-select');
            const tableSelect = sidebarContent.querySelector('#table-select');
            const typeSelect = sidebarContent.querySelector('#type-select');
            const addLayerBtn = sidebarContent.querySelector('#add-layer-btn');
            populateSchemaDropdown(schemaSelect, tableSelect, addLayerBtn);
            schemaSelect.addEventListener('change', () => {
                const selectedSchema = schemaSelect.value;
                tableSelect.innerHTML = '<option value="">Select a table...</option>';
                tableSelect.disabled = !selectedSchema;
                typeSelect.innerHTML = '<option value="">Select a type...</option>';
                typeSelect.disabled = true;
                addLayerBtn.disabled = true;
                if (selectedSchema) {
                    const tables = window.schemasAndTables?.[selectedSchema] || [];
                    tables.forEach(table => {
                        const option = document.createElement('option');
                        option.value = table;
                        option.textContent = remapTableName(table);
                        tableSelect.appendChild(option);
                    });
                }
            });
            tableSelect.addEventListener('change', async () => {
                typeSelect.innerHTML = '<option value="">Select a type...</option>';
                typeSelect.disabled = true;
                addLayerBtn.disabled = true;
                const schema = schemaSelect.value;
                const table = tableSelect.value;
                if (schema && table) {
                    // Fetch geometry type and populate type dropdown
                    const authToken = localStorage.getItem('authToken');
                    let geometryType = 'Point';
                    try {
                        const geomResp = await fetch(`/api/v1/map-data/geometry-type/${schema}/${table}`, {
                            headers: { 'Authorization': `Bearer ${authToken}` }
                        });
                        if (geomResp.ok) {
                            const geomData = await geomResp.json();
                            if (geomData.geometryType) {
                                const g = geomData.geometryType.toLowerCase();
                                if (g.includes('point')) geometryType = 'Point';
                                else if (g.includes('linestring')) geometryType = 'LineString';
                                else if (g.includes('polygon')) geometryType = 'Polygon';
                            }
                        }
                    } catch (e) { }
                    import('/static/js/map_layers.js').then(mod => {
                        const allowedTypes = mod.GEOMETRY_LAYER_TYPES[geometryType] || [];
                        typeSelect.innerHTML = '<option value="">Select a type...</option>' + allowedTypes.map(t => `<option value="${t}">${remapType(t)}</option>`).join('');
                        typeSelect.disabled = false;
                    });
                }
            });
            typeSelect.addEventListener('change', () => {
                addLayerBtn.disabled = !typeSelect.value;
            });
            addLayerBtn.addEventListener('click', async () => {
                const schema = schemaSelect.value;
                const table = tableSelect.value;
                const type = typeSelect.value;
                if (schema && table && type) {
                    // Fetch geometry type
                    const authToken = localStorage.getItem('authToken');
                    let geometryType = 'Point';
                    try {
                        const geomResp = await fetch(`/api/v1/map-data/geometry-type/${schema}/${table}`, {
                            headers: { 'Authorization': `Bearer ${authToken}` }
                        });
                        if (geomResp.ok) {
                            const geomData = await geomResp.json();
                            if (geomData.geometryType) {
                                const g = geomData.geometryType.toLowerCase();
                                if (g.includes('point')) geometryType = 'Point';
                                else if (g.includes('line')) geometryType = 'LineString';
                                else if (g.includes('polygon')) geometryType = 'Polygon';
                            }
                        }
                    } catch (e) { }

                    // Add layer to list
                    const layerName = `${schema}.${table}`;
                    layerList.push({
                        name: layerName,
                        schema,
                        table,
                        type,
                        geometryType,
                        visible: true
                    });

                    // Add source and layers to map
                    await addLayerToMap(schema, table, type, geometryType);

                    // Update UI
                    renderLayerList();
                    renderStyleDropdown();
                }
            });
        } else if (sidebarMode === 'style') {
            sidebarContent.innerHTML = `
                <h2 class="text-lg font-semibold text-gray-800 mb-6">Layer Styling</h2>
                <div class="mb-4">
                    <label for="style-layer-select" class="block text-sm font-medium text-gray-700 mb-2">Select Layer to Style</label>
                    <div class="relative">
                        <select id="style-layer-select" class="block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer">
                            <option value="">Select a layer...</option>
                        </select>
                    </div>
                </div>
            `;
            // Only render style dropdown, no type dropdown here
            renderStyleDropdown();
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Sidebar toggle logic
    function openSidebar(mode) {
        sidebarMode = mode;
        renderSidebar();
        sidebar.classList.remove('translate-x-full');
        sidebar.classList.add('mr-4');
        // Animate toggle group with sidebar
        sidebarToggleGroup.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
        sidebarToggleGroup.style.transform = 'translate(-21rem, -50%)';
    }
    function closeSidebar() {
        sidebar.classList.add('translate-x-full');
        sidebar.classList.remove('mr-4');
        // Animate toggle group with sidebar
        sidebarToggleGroup.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
        sidebarToggleGroup.style.transform = 'translate(0, -50%)';
        sidebarMode = null;
    }
    // Toggle logic for both buttons
    sidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebarMode === 'layers' && !sidebar.classList.contains('translate-x-full')) {
            closeSidebar();
        } else {
            openSidebar('layers');
        }
    });
    styleSidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebarMode === 'style' && !sidebar.classList.contains('translate-x-full')) {
            closeSidebar();
        } else {
            openSidebar('style');
        }
    });
    // Close sidebar on outside click
    document.addEventListener('click', (e) => {
        if (!sidebar.classList.contains('translate-x-full') &&
            !sidebar.contains(e.target) &&
            !sidebarToggleGroup.contains(e.target)) {
            closeSidebar();
        }
    });

    // --- Layer Group List Logic ---
    let sortableInstance = null; // Store SortableJS instance globally
    function renderLayerList() {
        const ul = sidebarContent.querySelector('#layer-list');
        ul.innerHTML = '';
        // Make the layer group vertical, full width, and scrollable
        ul.style.display = 'flex';
        ul.style.flexDirection = 'column';
        ul.style.overflowY = 'auto';
        ul.style.overflowX = 'hidden';
        ul.style.maxHeight = '220px'; // Adjust as needed for sidebar height
        ul.style.width = '100%';
        ul.style.gap = '0.5rem';
        ul.style.paddingBottom = '0.5rem';
        // Group layers by type for badge color
        const typeColors = {
            Circle: 'bg-blue-100 text-blue-700 border-blue-300',
            Symbol: 'bg-green-100 text-green-700 border-green-300',
            Heatmap: 'bg-yellow-100 text-yellow-700 border-yellow-300',
            Line: 'bg-purple-100 text-purple-700 border-purple-300',
            Fill: 'bg-pink-100 text-pink-700 border-pink-300',
        };
        layerList.forEach((layer, idx) => {
            const li = document.createElement('li');
            li.className = 'flex items-center bg-gray-100 rounded px-2 py-1 border border-gray-200 w-full';
            li.style.marginBottom = '0';
            li.setAttribute('data-layer-idx', idx);
            // Add a pan (drag) icon to the left
            li.innerHTML = `
                <span class="drag-handle mr-2 cursor-move" title="Drag to reorder">
                    <i data-lucide="move" class="w-4 h-4 text-gray-400"></i>
                </span>
                <span class="truncate font-medium">${remapTableName(layer.table)}</span>
                <span class="ml-2 px-2 py-0.5 rounded text-xs font-semibold border ${typeColors[layer.type] || 'bg-gray-200 text-gray-700 border-gray-300'}">${remapType(layer.type)}</span>
                <span class="flex gap-1 ml-auto">
                    <button class="toggle-layer-btn p-1 rounded hover:bg-blue-100 focus:outline-none" data-idx="${idx}" title="Toggle visibility">
                        <i data-lucide="${layer.visible ? 'eye' : 'eye-off'}" class="w-5 h-5 ${layer.visible ? 'text-blue-600' : 'text-gray-400'}"></i>
                    </button>
                    <button class="remove-layer-btn p-1 rounded hover:bg-red-100 focus:outline-none" data-idx="${idx}" title="Remove layer">
                        <i data-lucide="x" class="w-5 h-5 text-red-500"></i>
                    </button>
                </span>
            `;
            ul.appendChild(li);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
        // Attach events after rendering
        ul.querySelectorAll('.toggle-layer-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = +btn.dataset.idx;
                const layer = layerList[idx];
                layer.visible = !layer.visible;

                // Find all Mapbox layer IDs for this layer
                const layerIds = [];
                if (layer.type === 'Fill') {
                    layerIds.push(
                        `${layer.schema.toLowerCase()}.${layer.table.toLowerCase()}-fill`,
                        `${layer.schema.toLowerCase()}.${layer.table.toLowerCase()}-outline`
                    );
                } else if (layer.type === 'Line') {
                    layerIds.push(
                        `${layer.schema}.${layer.table}-network-outline`,
                        `${layer.schema}.${layer.table}-network-fill`
                    );                } else if (layer.type === 'Symbol') {
                    layerIds.push(`${layer.schema}.${layer.table}-symbols`);
                } else if (layer.type === 'Circle') {
                    layerIds.push(`${layer.schema}.${layer.table}-circles`);
                } else if (layer.type === 'Heatmap') {
                    layerIds.push(`${layer.schema}.${layer.table}-heat`);
                }

                // Toggle visibility for each layer
                layerIds.forEach(id => {
                    if (map.getLayer(id)) {
                        map.setLayoutProperty(id, 'visibility', layer.visible ? 'visible' : 'none');
                    }
                });

                renderLayerList();
                renderStyleDropdown();
                console.log(`Layer toggled:`, {
                    name: remapTableName(layer.table),
                    type: remapType(layer.type),
                    visible: layer.visible
                });
            };
        });
        ul.querySelectorAll('.remove-layer-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = +btn.dataset.idx;
                const removed = layerList[idx];

                // Get source and layer IDs
                const sourceName = `${removed.table.toLowerCase()}_tiles`;
                const layerIds = [];
                if (removed.type === 'Fill') {
                    layerIds.push(
                        `${removed.schema.toLowerCase()}.${removed.table.toLowerCase()}-fill`,
                        `${removed.schema.toLowerCase()}.${removed.table.toLowerCase()}-outline`
                    );
                } else if (removed.type === 'Line') {
                    layerIds.push(
                        `${removed.schema}.${removed.table}-network-outline`,
                        `${removed.schema}.${removed.table}-network-fill`
                    );
                } else if (removed.type === 'Symbol') {
                    layerIds.push(`${removed.schema}.${removed.table}-symbols`);
                } else if (removed.type === 'Circle') {
                    layerIds.push(`${removed.schema}.${removed.table}-circles`);
                } else if (removed.type === 'Heatmap') {
                    layerIds.push(`${removed.schema}.${removed.table}-heat`);
                }

                // Remove layers and source from map
                try {
                    // Remove layers first
                    layerIds.forEach(id => {
                        if (map.getLayer(id)) {
                            map.removeLayer(id);
                            console.log(`Removed layer: ${id}`);
                        }
                    });

                    // Then remove source
                    if (map.getSource(sourceName)) {
                        map.removeSource(sourceName);
                        console.log(`Removed source: ${sourceName}`);
                    }
                } catch (error) {
                    console.error('Error removing layers/source:', error);
                }

                // Remove from layerList
                layerList.splice(idx, 1);
                renderLayerList();
                renderStyleDropdown();
                console.log(`Layer removed:`, {
                    name: remapTableName(removed.table),
                    type: remapType(removed.type)
                });
            };
        });

        // --- SortableJS Integration ---
        // Ensure SortableJS is loaded
        if (window.Sortable) {
            // Destroy previous instance if exists
            if (ul._sortableInstance) {
                ul._sortableInstance.destroy();
                ul._sortableInstance = null;
            }
            // Initialize SortableJS even if ul is empty
            ul._sortableInstance = Sortable.create(ul, {
                animation: 150,
                handle: '.drag-handle', // Only allow dragging by the pan icon
                ghostClass: 'bg-blue-50',
                onEnd: function (evt) {
                    // Reorder layerList to match new order
                    const draggedIdx = evt.oldIndex;
                    const newIdx = evt.newIndex;
                    if (draggedIdx !== newIdx) {
                        const moved = layerList.splice(draggedIdx, 1)[0];
                        layerList.splice(newIdx, 0, moved);
                    }
                    const draggedLayer = layerList[newIdx];
                    const aboveLayer = newIdx > 0 ? layerList[newIdx - 1] : null;
                    const belowLayer = newIdx < layerList.length - 1 ? layerList[newIdx + 1] : null;
                    function getLayerDefIds(layer) {
                        if (!layer) return [];
                        if (layer.type === 'Fill') {
                            return [
                                `${layer.schema.toLowerCase()}.${layer.table.toLowerCase()}-fill`,
                                `${layer.schema.toLowerCase()}.${layer.table.toLowerCase()}-outline`
                            ];
                        } else if (layer.type === 'Line') {
                            return [
                                `${layer.schema}.${layer.table}-network-outline`,
                                `${layer.schema}.${layer.table}-network-fill`
                            ];
                        } else if (layer.type === 'Symbol') {
                            return [`${layer.schema}.${layer.table}-symbols`];
                        } else if (layer.type === 'Circle') {
                            return [`${layer.schema}.${layer.table}-circles`];
                        } else if (layer.type === 'Heatmap') {
                            return [`${layer.schema}.${layer.table}-heat`];
                        }
                        return [];
                    }
                    const draggedIds = getLayerDefIds(draggedLayer);
                    const aboveIds = getLayerDefIds(aboveLayer);
                    const belowIds = getLayerDefIds(belowLayer);
                    if (draggedLayer) {
                        console.log('Dragged layer definition IDs:', draggedIds);
                    }
                    if (aboveLayer) {
                        console.log('Above layer definition IDs:', aboveIds);
                    }
                    if (belowLayer) {
                        console.log('Below layer definition IDs:', belowIds);
                    }
                    // --- Mapbox moveLayer logic ---
                    // Move all draggedIds below the first aboveId (or to bottom if no aboveLayer)
                    if (draggedIds.length > 0) {
                        let beforeId = aboveIds && aboveIds.length > 0 ? aboveIds[0] : null;
                        // Move in order so the last in draggedIds ends up at the bottom
                        for (let i = 0; i < draggedIds.length; i++) {
                            const id = draggedIds[i];
                            if (map.getLayer(id)) {
                                map.moveLayer(id, beforeId);
                                console.log(`Moved Layer ${id} below ${beforeId || 'bottom'}.`);
                            }
                        }
                    }
                }
            });
        } else {
            console.warn('SortableJS is not loaded. Drag-and-drop will not work.');
        }
    }
    // --- Style Dropdown Logic ---
    function renderStyleDropdown() {
        if (sidebarMode !== 'style') return;
        const select = sidebarContent.querySelector('#style-layer-select');
        select.innerHTML = '<option value="">Select a layer...</option>';
        layerList.forEach(layer => {
            const option = document.createElement('option');
            option.value = layer.name;
            // Show type and table name only
            let colorDot = '';
            switch (layer.type) {
                case 'Circle': colorDot = '🔵'; break;
                case 'Symbol': colorDot = '🟢'; break;
                case 'Heatmap': colorDot = '🟡'; break;
                case 'Line': colorDot = '🟣'; break;
                case 'Fill': colorDot = '🔴'; break;
                default: colorDot = '⚪';
            }
            option.textContent = `${colorDot} ${remapTableName(layer.table)}`;
            select.appendChild(option);
        });        // Render the filter row (but it won't affect the layer)
        renderLayerTypeRow(select.value, { onlyFilter: true });
        select.onchange = async () => {
            await fetchAndSetLayerFields(select.value);
            renderLayerTypeRow(select.value, { onlyFilter: true });
            // Update user_id filter if needed
            await updateLayerFilter(select.value);
        };
        // Fetch fields for the initially selected layer (if any)
        if (select.value) {
            fetchAndSetLayerFields(select.value).then(() => {
                renderLayerTypeRow(select.value, { onlyFilter: true });
            });
        }
    }

    // Fetch fields for a given layerName and store in layerFields
    async function fetchAndSetLayerFields(layerName) {
        if (!layerName) return;
        if (layerFields[layerName]) return; // Already fetched
        const layer = layerList.find(l => l.name === layerName);
        if (!layer) return;
        const authToken = localStorage.getItem('authToken');
        try {
            const resp = await fetch(`/api/v1/map-data/fields/${layer.schema}/${layer.table}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                // Expecting data.fields: [{name, type}]
                layerFields[layerName] = (data.fields || []).map(f => ({ value: f.name, label: f.name }));
            }
        } catch (e) {
            // Ignore errors, fallback to empty
            layerFields[layerName] = [];
        }
    }

    // Add a row with label and dropdown for Field (filter), optionally only filter
    function renderLayerTypeRow(layerName, opts = {}) {
        // Remove previous if exists
        const prev = sidebarContent.querySelector('#layer-type-row');
        if (prev) prev.remove();
        const prevField = sidebarContent.querySelector('#layer-field-row');
        if (prevField) prevField.remove();        // Only render filter row if onlyFilter is true
        if (opts.onlyFilter) {
            let fieldOptions = '<option value="">Select a field...</option>';
            let fields = [];
            if (layerName && layerFields[layerName]) {
                fields = layerFields[layerName];
                fieldOptions = '<option value="">Select a field...</option>' + fields.map(f => `<option value="${f.value}">${remapFilterField(f.label)}</option>`).join('');
            }
            const fieldRow = document.createElement('div');
            fieldRow.id = 'layer-field-row';
            fieldRow.className = 'flex items-center gap-2 mt-4';
            fieldRow.innerHTML = `
                <label for="layer-field-select" class="block text-sm font-medium text-gray-700 mb-0">Filter</label>
                <select id="layer-field-select" class="flex-1 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer">
                    ${fieldOptions}
                </select>
            `;
            // Insert after the layer select
            const layerSelectDiv = sidebarContent.querySelector('#style-layer-select').parentElement.parentElement;
            layerSelectDiv.parentNode.insertBefore(fieldRow, layerSelectDiv.nextSibling);            // Add change event listener to filter select
            const filterSelect = fieldRow.querySelector('#layer-field-select');
            filterSelect.addEventListener('change', async () => {
                // Do nothing with the filter selection for now
                // We'll use this for something else later
                console.log('Filter field selected:', filterSelect.value);
            });
        } else {
            // ...existing code for full type+filter row...
            // ...existing code...
        }
    }


    // --- Schema/Table API logic (reuse your existing fetch logic) ---
    window.schemasAndTables = {};
    async function fetchSchemasAndTables() {
        try {
            const response = await fetch('/api/v1/map-data/api/schemas-and-tables');
            if (!response.ok) throw new Error('Failed to fetch schemas and tables');
            window.schemasAndTables = await response.json();
            if (sidebarMode === 'layers') {
                renderSidebar();
            }
        } catch (error) {
            console.error('Error fetching schemas and tables:', error);
        }
    }
    function populateSchemaDropdown(schemaSelect, tableSelect, addLayerBtn) {
        if (!schemaSelect) return;
        schemaSelect.innerHTML = '<option value="">Select a schema...</option>';
        Object.keys(window.schemasAndTables).forEach(schema => {
            const option = document.createElement('option');
            option.value = schema;
            option.textContent = remapSchemaName(schema);
            schemaSelect.appendChild(option);
        });
        if (tableSelect) tableSelect.innerHTML = '<option value="">Select a table...</option>';
        if (addLayerBtn) addLayerBtn.disabled = true;
    }
    // Initial fetch
    fetchSchemasAndTables();

    // --- AG Grid Offers Table Logic ---
    const offersTableContainer = document.getElementById('offers-table-container');
    const offersTableChevron = document.getElementById('offers-table-chevron');
    const offersAgGridDiv = document.getElementById('offers-ag-grid');
    const offersTableToggleBtn = document.getElementById('toggle-offers-table');
    let offersTableOpen = false;

    // --- Fix: Table height and chevron gap ---
    // Helper to update table/chevron positions and heights
    function updateOffersTableLayout() {
        if (offersTableOpen) {
            offersTableContainer.style.transform = 'translateY(0)';
            offersTableContainer.style.height = '40vh'; // Fixed height when open
            offersAgGridDiv.style.height = '100%'; // AG Grid fills container
            offersTableChevron.style.transform = 'rotate(180deg)';
            offersTableToggleBtn.style.transform = 'translate(-50%, 0)';
            offersTableToggleBtn.style.bottom = 'calc(40vh + 12px)'; // Add 12px gap above table
        } else {
            offersTableContainer.style.transform = 'translateY(100%)';
            offersTableContainer.style.height = '40vh'; // Keep height for animation
            offersAgGridDiv.style.height = '100%';
            offersTableChevron.style.transform = 'rotate(0deg)';
            offersTableToggleBtn.style.transform = 'translate(-50%, 0)';
            offersTableToggleBtn.style.bottom = '10px'; // At bottom of viewport
        }
    }
    function toggleOffersTable() {
        offersTableOpen = !offersTableOpen;
        updateOffersTableLayout();
    }
    offersTableToggleBtn.addEventListener('click', toggleOffersTable);
    // On load, ensure correct initial state
    updateOffersTableLayout();

    // AG Grid setup
    let offersGrid;
    async function fetchOffersSummary() {
        try {
            const authToken = localStorage.getItem('authToken');
            if (!authToken) return;
            const response = await fetch('/api/v1/map-data/offers-summary', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) throw new Error('Failed to fetch offers summary');
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('Error fetching offers summary:', err);
            return [];
        }
    }
    async function initOffersGrid() {
        const rowData = await fetchOffersSummary();
        const columnDefs = [
            { headerName: 'ID', field: 'id', minWidth: 60 },
            { headerName: 'Remark', field: 'remark', minWidth: 140 },
            { headerName: 'Date', field: 'date', minWidth: 100 },
            { headerName: 'Time', field: 'time', minWidth: 90 },
            { headerName: 'Street #', field: 'street_number', minWidth: 80 },
            { headerName: 'Street Name', field: 'street_name', minWidth: 140 },
            { headerName: 'Suburb', field: 'suburb', minWidth: 120 },
            { headerName: 'State', field: 'state', minWidth: 60 },
            { headerName: 'Frontage', field: 'frontage', minWidth: 80 },
            { headerName: 'SQM', field: 'sqm', minWidth: 80 },
            { headerName: 'Offer', field: 'offer', minWidth: 180 },
            { headerName: 'Comment', field: 'comment', minWidth: 180 },
        ];
        offersGrid = agGrid.createGrid(offersAgGridDiv, {
            columnDefs,
            rowData,
            defaultColDef: { resizable: true, sortable: true, filter: true },
            domLayout: 'normal',
            animateRows: true,
            theme: 'legacy',
        });
    }
    if (window.agGrid) initOffersGrid();

    // --- Basemap Switcher Logic ---
    const basemapSwitcherBtn = document.getElementById('basemap-switcher-btn');
    const basemapOptionsDiv = document.getElementById('basemap-options');    // Basemap definitions
    const basemaps = [
        { 
            key: 'none', 
            label: 'Plain', 
            style: {
                version: 8,
                sources: {},
                layers: [{
                    id: 'background',
                    type: 'background',
                    paint: { 'background-color': '#ffffff' }
                }]
            },
            img: '/static/images/basemaps/plain.png'  // You'll need to add this image
        },
        { key: 'streets', label: 'Streets', style: 'mapbox://styles/mapbox/streets-v12', img: '/static/images/basemaps/streets.png' },
        { key: 'outdoors', label: 'Outdoors', style: 'mapbox://styles/mapbox/outdoors-v12', img: '/static/images/basemaps/outdoors.png' },
        { key: 'light', label: 'Light', style: 'mapbox://styles/mapbox/light-v11', img: '/static/images/basemaps/light.png' },
        { key: 'dark', label: 'Dark', style: 'mapbox://styles/mapbox/dark-v11', img: '/static/images/basemaps/dark.png' },
        { key: 'satellite', label: 'Satellite', style: 'mapbox://styles/mapbox/satellite-v9', img: '/static/images/basemaps/satellite.png' },
        { key: 'hybrid', label: 'Hybrid', style: 'mapbox://styles/mapbox/satellite-streets-v12', img: '/static/images/basemaps/hybrid.png' },
    ];
    // Render basemap options
    function renderBasemapOptions() {
        basemapOptionsDiv.innerHTML = '';
        basemaps.forEach(bm => {
            const fig = document.createElement('figure');
            fig.className = 'flex flex-col items-center cursor-pointer group';
            fig.innerHTML = `                <img src="${bm.img}" alt="${bm.label}" class="w-16 h-16 object-cover rounded-lg border border-gray-300">
                <figcaption class="mt-1 text-xs text-gray-700">${bm.label}</figcaption>
            `;            fig.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (window.map && typeof window.map.setStyle === 'function') {
                    // Capture the current state before style change
                    const mapState = {
                        center: window.map.getCenter(),
                        zoom: window.map.getZoom(),
                        bearing: window.map.getBearing(),
                        pitch: window.map.getPitch(),
                        layers: layerList.map(layer => ({...layer}))
                    };

                    // Change the style
                    window.map.setStyle(bm.style);

                    // When the style loads, restore our layers
                    window.map.once('style.load', () => {
                        // Restore each layer
                        mapState.layers.forEach(async layer => {
                            await addLayerToMap(layer.schema, layer.table, layer.type, layer.geometryType);
                            
                            // Restore visibility state if it was hidden
                            if (!layer.visible) {
                                const layerIds = getLayerIds(layer);
                                layerIds.forEach(id => {
                                    if (window.map.getLayer(id)) {
                                        window.map.setLayoutProperty(id, 'visibility', 'none');
                                    }
                                });
                            }
                        });

                        // Restore map position
                        window.map.setCenter(mapState.center);
                        window.map.setZoom(mapState.zoom);
                        window.map.setBearing(mapState.bearing);
                        window.map.setPitch(mapState.pitch);
                    });
                } else if (typeof map !== 'undefined' && typeof map.setStyle === 'function') {
                    // Same logic for map object
                    const mapState = {
                        center: map.getCenter(),
                        zoom: map.getZoom(),
                        bearing: map.getBearing(),
                        pitch: map.getPitch(),
                        layers: layerList.map(layer => ({...layer}))
                    };

                    map.setStyle(bm.style);

                    map.once('style.load', () => {
                        mapState.layers.forEach(async layer => {
                            await addLayerToMap(layer.schema, layer.table, layer.type, layer.geometryType);
                            
                            if (!layer.visible) {
                                const layerIds = getLayerIds(layer);
                                layerIds.forEach(id => {
                                    if (map.getLayer(id)) {
                                        map.setLayoutProperty(id, 'visibility', 'none');
                                    }
                                });
                            }
                        });

                        map.setCenter(mapState.center);
                        map.setZoom(mapState.zoom);
                        map.setBearing(mapState.bearing);
                        map.setPitch(mapState.pitch);
                    });
                }
                closeBasemapOptions();
            });
            basemapOptionsDiv.appendChild(fig);
        });
    }
    function openBasemapOptions() {
        basemapOptionsDiv.classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
        basemapOptionsDiv.classList.add('scale-100', 'opacity-100');
    }
    function closeBasemapOptions() {
        basemapOptionsDiv.classList.add('scale-0', 'opacity-0', 'pointer-events-none');
        basemapOptionsDiv.classList.remove('scale-100', 'opacity-100');
    }
    basemapSwitcherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        renderBasemapOptions();
        if (basemapOptionsDiv.classList.contains('scale-0')) {
            openBasemapOptions();
        } else {
            closeBasemapOptions();
        }
    });
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!basemapOptionsDiv.contains(e.target) && !basemapSwitcherBtn.contains(e.target)) {
            closeBasemapOptions();
        }
    });

    // If you set font-family in JS, use Barlow:
    document.body.style.fontFamily = "'Barlow', sans-serif";

    async function getFieldList(schema, table) {
        const authToken = localStorage.getItem('authToken');
        try {
            const resp = await fetch(`/api/v1/map-data/fields/${schema}/${table}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                return data.fields || [];
            }
        } catch (e) {
            console.error('Error fetching fields:', e);
        }
        return [];
    }    async function createLayerFilter(fields) {
        // Start with a valid default filter that accepts everything
        let filter = ["all"];
        
        // Check for user_id
        const hasUserId = fields.some(f => f.name === 'user_id');
        console.log('Table has user_id:', hasUserId);

        // If table has user_id, get the current user's ID and create a filter
        if (hasUserId) {
            const authToken = localStorage.getItem('authToken');
            try {
                const userResp = await fetch('/api/v1/users/me', {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (userResp.ok) {
                    const userData = await userResp.json();
                    filter.push(['==', ['get', 'user_id'], userData.id]);
                    console.log('Created user_id filter:', filter);
                } else {
                    console.error('Failed to fetch user data for filter, status:', userResp.status);
                    return null; // Return null if we can't get the user ID - this prevents showing data without proper filtering
                }
            } catch (e) {
                console.error('Error fetching user data for filter:', e);
                return null; // Return null if we can't get the user ID - this prevents showing data without proper filtering
            }
        }
        
        // Log the final filter
        console.log('Final filter:', filter);
        
        // If filter only contains ["all"] with no conditions, it will allow everything
        return filter;
    }

    async function addLayerToMap(schema, table, type, geometryType) {
        console.log('Adding layer with parameters:', { schema, table, type, geometryType });
          // Get fields and create filter (only for user_id)
        const fields = await getFieldList(schema, table);
        const filter = await createLayerFilter(fields);
        
        console.log('Layer filter:', filter);

        const sourceName = `${table.toLowerCase()}_tiles`;
        const sourceLayer = `${table.toLowerCase()}`;
        const sourceDef = {
            type: 'vector',
            tiles: [`http://localhost:8000/api/v1/map-data/proxy/tiles/${table.toLowerCase()}/{z}/{x}/{y}.pbf`],
            maxzoom: 20
        };

        let layers = [];
        if (type === 'Fill') {
            console.log(`Adding Fill layer for ${schema}.${table}`);
            layers = [
                {
                    id: `${schema.toLowerCase()}.${table.toLowerCase()}-fill`,
                    type: 'fill',
                    source: sourceName,
                    'source-layer': sourceLayer,
                    paint: {
                        'fill-opacity': 0.2,
                        'fill-color': '#ffffff'
                    }
                },
                {
                    id: `${schema.toLowerCase()}.${table.toLowerCase()}-outline`,
                    type: 'line',
                    source: sourceName,
                    'source-layer': sourceLayer,
                    paint: {
                        'line-color': '#d2dae2',
                        'line-width': 0.3,
                        'line-opacity': 0.7
                    }
                }
            ];            // Add filter to both layers only if it's a valid array
            if (Array.isArray(filter)) {
                layers[0].filter = filter;
                layers[1].filter = filter;
            }
        } else if (type === 'Line') {
            layers = [
                {
                    id: `${schema}.${table}-network-outline`,
                    type: 'line',
                    source: sourceName,
                    'source-layer': sourceLayer,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'],
                            14, 2,
                            20, 30
                        ],
                        'line-color': '#f2a787',
                        'line-opacity': ['interpolate', ['linear'], ['zoom'],
                            14, 0.7,
                            22, 1
                        ]
                    }
                },
                {
                    id: `${schema}.${table}-network-fill`,
                    type: 'line',
                    source: sourceName,
                    'source-layer': sourceLayer,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'],
                            14, 1.5,
                            20, 20
                        ],
                        'line-color': '#f0d9ce',
                        'line-opacity': ['interpolate', ['linear'], ['zoom'],
                            14, 0.5,
                            22, 1
                        ]
                    },
                    filter
                }
            ];
        } else if (type === 'Symbol') {
            layers = [{
                id: `${schema}.${table}-symbols`,
                type: 'symbol',
                source: sourceName,
                'source-layer': sourceLayer,
                filter,
                minzoom: 16,
                layout: {
                    'icon-image': [
                        'match', ['get', 'icon'],
                        'Accepted', 'accepted',
                        'Agreement Prep', 'agreement_prep',
                        'Agreement Signed', 'agreement_signed',
                        'Built', 'built',
                        'Construction', 'construction',
                        'Countered', 'not_home',
                        'For Sale', 'for_sale',
                        'Not Home', 'not_home',
                        'Not Interested', 'not_interested',
                        'Not Interested2', 'not_interested2',
                        'Offer Given', 'offer_given',
                        'Rejected Offer', 'rejected_offer',
                        'Settled', 'settled',
                        'Sold', 'sold',
                        'Tenanted', 'tenanted',
                        'Unknown', 'unknown',
                        'Wants Offer', 'wants_offer',
                        ''
                    ],
                    'icon-size': [
                        'interpolate', ['linear'], ['zoom'],
                        16, 0.05,
                        19, 0.5,
                        22, 0.7
                    ],
                    'icon-offset': [
                        'interpolate', ['linear'], ['zoom'],
                        16, ['literal', [0, -2]],
                        17, ['literal', [0, -2.5]],
                        18, ['literal', [0, -3]]
                    ],                    'icon-anchor': 'center',
                    'text-field': ['get', 'road_id'], // Default to 'road_id' field or empty string if not available
                    'text-size': [
                        'interpolate', ['linear'], ['zoom'],
                        16, 7,
                        19, 11,
                        22, 14
                    ],
                    'text-anchor': 'center',
                    'text-offset': [
                        'interpolate', ['linear'], ['zoom'],
                        16, ['literal', [0, 2]],
                        17, ['literal', [0, 2.5]],
                        18, ['literal', [0, 3]]
                    ]
                },
                paint: {
                    'text-color': '#2c2c2c'
                }
            }];
        } else if (type === 'Circle') {
            layers = [{
                id: `${schema}.${table}-circles`,
                type: 'circle',
                source: sourceName,
                'source-layer': sourceLayer,
                filter,
                paint: {
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        12, 2,
                        22, 12
                    ],
                    'circle-color': '#FF0000',
                    'circle-opacity': 0.7,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#FFFFFF'
                }
            }];
        } else if (type === 'Heatmap') {
            layers = [{
                id: `${schema}.${table}-heat`,
                type: 'heatmap',
                source: sourceName,
                'source-layer': sourceLayer,
                filter,
                paint: {
                    'heatmap-intensity': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 1,
                        9, 3
                    ],
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0, 'rgba(33,102,172,0)',
                        0.2, 'rgb(103,169,207)',
                        0.4, 'rgb(209,229,240)',
                        0.6, 'rgb(253,219,199)',
                        0.8, 'rgb(239,138,98)',
                        1, 'rgb(178,24,43)'
                    ],
                    'heatmap-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        0, 2,
                        9, 20
                    ],
                    'heatmap-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        7, 1,
                        9, 0.75
                    ]
                }
            }];
        }        // Add source and layers to map
        try {
            // Only remove layers that use the source, not the source itself if it is still needed
            if (map.getSource(sourceName)) {
                layers.forEach(layer => {
                    if (map.getLayer(layer.id)) {
                        map.removeLayer(layer.id);
                    }
                });
                // Do NOT remove the source if it already exists; just reuse it
            } else {
                // Add new source only if it does not exist
                map.addSource(sourceName, sourceDef);
                console.log(`Added source: ${sourceName}`, sourceDef);
            }

            // Add each layer with debug logging
            layers.forEach(layer => {
                try {
                    map.addLayer(layer);
                    console.log(`Successfully added layer: ${layer.id}`, {
                        id: layer.id,
                        source: layer.source,
                        'source-layer': layer['source-layer'],
                        filter: layer.filter
                    });

                    // Verify the layer was added
                    const addedLayer = map.getLayer(layer.id);
                    if (addedLayer) {
                        console.log(`Layer ${layer.id} verified on map:`, addedLayer);
                    } else {
                        console.warn(`Layer ${layer.id} not found after adding`);
                    }

                    // Check if source is loaded
                    const source = map.getSource(sourceName);
                    if (source) {
                        console.log(`Source ${sourceName} is loaded:`, source);
                    } else {
                        console.warn(`Source ${sourceName} not found`);
                    }
                } catch (error) {
                    console.error(`Error adding layer ${layer.id}:`, error);
                }
            });

            map.on('error', (e) => {
                if (e.error && e.error.message.includes(sourceName)) {
                    console.error(`Tile loading error for ${sourceName}:`, e.error);
                }
            });

            // Update tracking list only if this exact layer (schema, table, type) was successfully added
            const existingLayerIndex = layerList.findIndex(l => l.schema === schema && l.table === table && l.type === type);
            if (existingLayerIndex >= 0) {
                layerList[existingLayerIndex] = {
                    name: `${schema}.${table}.${type}`,
                    schema,
                    table,
                    type,
                    geometryType,
                    visible: true
                };
            } else {
                layerList.push({
                    name: `${schema}.${table}.${type}`,
                    schema,
                    table,
                    type,
                    geometryType,
                    visible: true
                });
            }

            // Update UI
            renderLayerList();
            renderStyleDropdown();
        } catch (error) {
            console.error('Error adding layer to map:', error);
        }

        // --- After adding, enforce correct stacking order ---
        // Collect all layer IDs in the order of layerList (bottom to top in UI = top to bottom in map)
        let allLayerIds = [];
        layerList.forEach(layer => {
            if (layer.type === 'Fill') {
                allLayerIds.push(`${layer.schema.toLowerCase()}.${layer.table.toLowerCase()}-fill`);
                allLayerIds.push(`${layer.schema.toLowerCase()}.${layer.table.toLowerCase()}-outline`);
            } else if (layer.type === 'Line') {
                allLayerIds.push(`${layer.schema}.${layer.table}-network-outline`);
                allLayerIds.push(`${layer.schema}.${layer.table}-network-fill`);
            } else if (layer.type === 'Symbol') {
                allLayerIds.push(`${layer.schema}.${layer.table}-symbols`);
            } else if (layer.type === 'Circle') {
                allLayerIds.push(`${layer.schema}.${layer.table}-circles`);
            } else if (layer.type === 'Heatmap') {
                allLayerIds.push(`${layer.schema}.${layer.table}-heat`);
            }
        });
        // Move each layer to the bottom in order (so first in list is on top visually)
        for (let i = allLayerIds.length - 1; i >= 0; i--) {
            const id = allLayerIds[i];
            if (map.getLayer(id)) {
                map.moveLayer(id);
                // No beforeId means move to top of stack (bottom visually)
            }
        }

        // Log the definitions
        const logObj = {
            addLayer: {
                schema: remapSchemaName(schema),
                table: remapTableName(table),
                geometryType,
                type: remapType(type)
            },
            source: { [sourceName]: sourceDef },
            layers
        };
        console.log('Adding layer:', logObj);
        console.log('Layer definitions:', JSON.stringify(layers, null, 2));

        return { sourceDef, layers };
    }

    // Update the Add Layer button click handler
    if (sidebarMode === 'layers') {
        // ...existing code...
        addLayerBtn.addEventListener('click', async () => {
            const schema = schemaSelect.value;
            const table = tableSelect.value;
            const type = typeSelect.value;
            if (schema && table && type) {
                // Fetch geometry type
                const authToken = localStorage.getItem('authToken');
                let geometryType = 'Point';
                try {
                    const geomResp = await fetch(`/api/v1/map-data/geometry-type/${schema}/${table}`, {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    if (geomResp.ok) {
                        const geomData = await geomResp.json();
                        if (geomData.geometryType) {
                            const g = geomData.geometryType.toLowerCase();
                            if (g.includes('point')) geometryType = 'Point';
                            else if (g.includes('line')) geometryType = 'LineString';
                            else if (g.includes('polygon')) geometryType = 'Polygon';
                        }
                    }
                } catch (e) { }

                // Add layer to list
                const layerName = `${schema}.${table}`;
                layerList.push({
                    name: layerName,
                    schema,
                    table,
                    type,
                    geometryType,
                    visible: true
                });

                // Add source and layers to map
                await addLayerToMap(schema, table, type, geometryType);

                // Update UI
                renderLayerList();
                renderStyleDropdown();
            }
        });

    }    async function updateLayerFilter(layerName) {
        const layer = layerList.find(l => l.name === layerName);
        if (!layer) return;

        // Get fields and create new filter (only for user_id)
        const fields = await getFieldList(layer.schema, layer.table);
        const newFilter = await createLayerFilter(fields);
        
        console.log('Updating filter for layer:', layer.name, 'with new filter:', newFilter);

        // Find all Mapbox layer IDs for this layer
        const layerIds = [];
        if (layer.type === 'Fill') {
            layerIds.push(
                `${layer.schema.toLowerCase()}.${layer.table.toLowerCase()}-fill`,
                `${layer.schema.toLowerCase()}.${layer.table.toLowerCase()}-outline`
            );
        } else if (layer.type === 'Line') {
            layerIds.push(
                `${layer.schema}.${layer.table}-network-outline`,
                `${layer.schema}.${layer.table}-network-fill`
            );
        } else if (layer.type === 'Symbol') {
            layerIds.push(`${layer.schema}.${layer.table}-symbols`);
        } else if (layer.type === 'Circle') {
            layerIds.push(`${layer.schema}.${layer.table}-circles`);
        } else if (layer.type === 'Heatmap') {
            layerIds.push(`${layer.schema}.${layer.table}-heat`);
        }        // Update filter for each layer
        layerIds.forEach(id => {
            if (map.getLayer(id)) {
                console.log('Updating filter for layer ID:', id);
                map.setFilter(id, newFilter);
                
                // Get and log the updated layer definition
                const layerDef = map.getLayer(id);
                const fullLayerDef = {
                    id: layerDef.id,
                    type: layerDef.type,
                    source: layerDef.source,
                    'source-layer': layerDef['source-layer'],
                    filter: newFilter,  // Show the newly applied filter
                    paint: layerDef.paint
                };

                // Add layout if it exists
                if (layerDef.layout) {
                    fullLayerDef.layout = layerDef.layout;
                }                // Format and print the layer definition in a clear, highly visible format
                const layerDefString = JSON.stringify(fullLayerDef, null, 2);
                const header = '🔄 LAYER UPDATE 🔄';
                const separator = '='.repeat(50);
                
                console.group('%cLayer Filter Update', 'font-size: 16px; color: #2196F3; font-weight: bold;');
                console.log('%c' + separator, 'color: #FF4081; font-weight: bold;');
                console.log('%c' + header, 'font-size: 14px; color: #4CAF50; font-weight: bold; background: #E8F5E9; padding: 5px; border-radius: 3px;');
                console.log('%c⚡ Layer ID: %c' + id, 'color: #FF4081; font-weight: bold;', 'color: #000000;');
                console.log('\n%cLayer Definition:', 'font-size: 12px; color: #2196F3; font-weight: bold;');
                console.log(fullLayerDef);
                console.log('%c' + separator + '\n', 'color: #FF4081; font-weight: bold;');
                console.groupEnd();
            }
        });
    }

    // Geocoding search elements
   
    const geocodingSearch = document.getElementById('geocoding-search');
    const geocodingResults = document.getElementById('geocoding-results');
    let debounceTimeout;

    // Initialize geocoding search functionality
    function initGeocoding() {
        geocodingSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(debounceTimeout);

            if (!query) {
                geocodingResults.innerHTML = '';
                geocodingResults.classList.add('hidden');
                return;
            }

            // Debounce the search to avoid too many API calls
            debounceTimeout = setTimeout(() => {
                searchLocation(query);
            }, 300);
        });

        // Close results when clicking outside
        document.addEventListener('click', (e) => {
            if (!geocodingSearch.contains(e.target) && !geocodingResults.contains(e.target)) {
                geocodingResults.classList.add('hidden');
            }
        });
    }

    // Search location using Mapbox Geocoding API
    async function searchLocation(query) {
        try {
            const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;            const params = new URLSearchParams({
                access_token: mapboxAccessToken,
                types: 'country,region,place,district,locality,neighborhood,address,poi',
                limit: 7,
                autocomplete: true,
                fuzzyMatch: true
            });

            const response = await fetch(`${endpoint}?${params}`);
            const data = await response.json();

            // Clear previous results
            geocodingResults.innerHTML = '';
            
            if (data.features.length === 0) {
                geocodingResults.innerHTML = `
                    <div class="px-4 py-2 text-sm text-gray-500">
                        No results found
                    </div>`;
                geocodingResults.classList.remove('hidden');
                return;
            }

            // Display results
            data.features.forEach(feature => {
                const div = document.createElement('div');
                div.className = 'px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer';
                div.innerHTML = feature.place_name;
                div.addEventListener('click', () => {
                    // Fly to the selected location
                    map.flyTo({
                        center: feature.center,
                        zoom: 15,
                        essential: true
                    });
                    geocodingSearch.value = feature.place_name;
                    geocodingResults.classList.add('hidden');
                });
                geocodingResults.appendChild(div);
            });

            geocodingResults.classList.remove('hidden');

        } catch (error) {
            console.error('Error searching location:', error);
            geocodingResults.innerHTML = `
                <div class="px-4 py-2 text-sm text-red-500">
                    Error searching location
               
                </div>`;
            geocodingResults.classList.remove('hidden');
        }
    }

    initGeocoding();
});
