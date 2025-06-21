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
        }

        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: initialCenter,
            zoom: initialZoom,
            minZoom: 0,
            maxZoom: 19,
            attributionControl: false, // Explicitly disable attribution control
            hash: true // Enable hash in URL for easy sharing
        });

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
            // Inline setupLayerSidebarEvents logic here
            const schemaSelect = sidebarContent.querySelector('#schema-select');
            const tableSelect = sidebarContent.querySelector('#table-select');
            const addLayerBtn = sidebarContent.querySelector('#add-layer-btn');
            populateSchemaDropdown(schemaSelect, tableSelect, addLayerBtn);
            schemaSelect.addEventListener('change', () => {
                const selectedSchema = schemaSelect.value;
                tableSelect.innerHTML = '<option value="">Select a table...</option>';
                tableSelect.disabled = !selectedSchema;
                addLayerBtn.disabled = true;
                if (selectedSchema) {
                    const tables = window.schemasAndTables?.[selectedSchema] || [];
                    tables.forEach(table => {
                        const option = document.createElement('option');
                        option.value = table;
                        option.textContent = table;
                        tableSelect.appendChild(option);
                    });
                }
            });
            tableSelect.addEventListener('change', () => {
                addLayerBtn.disabled = !tableSelect.value;
            });
            addLayerBtn.addEventListener('click', async () => {
                const schema = schemaSelect.value;
                const table = tableSelect.value;
                if (schema && table) {
                    const layerName = `${schema}.${table}`;
                    if (!layerList.some(l => l.name === layerName)) {
                        // --- Fetch geometry type from backend ---
                        const authToken = localStorage.getItem('authToken');
                        let geometryType = 'Point'; // fallback
                        try {
                            const geomResp = await fetch(`/api/v1/map-data/geometry-type/${schema}/${table}`, {
                                headers: { 'Authorization': `Bearer ${authToken}` }
                            });
                            if (geomResp.ok) {
                                const geomData = await geomResp.json();
                                // Normalize geometry type to Point, LineString, Polygon
                                if (geomData.geometryType) {
                                    const g = geomData.geometryType.toLowerCase();
                                    if (g.includes('point')) geometryType = 'Point';
                                    else if (g.includes('linestring')) geometryType = 'LineString';
                                    else if (g.includes('polygon')) geometryType = 'Polygon';
                                }
                            }
                        } catch (e) {
                            console.warn('Could not fetch geometry type, defaulting to Point:', e);
                        }
                        layerGeometryTypes[layerName] = geometryType;
                        import('/static/js/map_layers.js').then(mod => {
                            const sourceId = `${layerName}-source`;
                            const sourceUrl = `http://localhost:7800/${layerName.replace('.', '/')}/{z}/{x}/{y}.pbf`;
                            const mapSource = {
                                type: 'vector',
                                tiles: [sourceUrl],
                                minzoom: 0,
                                maxzoom: 20, // Adjust as needed
                                scheme: 'xyz'
                            };
                            console.log('Adding map source:', { id: sourceId, ...mapSource });
                            // Add default layer based on geometry type, with all possible keys
                            let defaultLayerDef;
                            if (geometryType === 'Point') {
                                defaultLayerDef = {
                                    ...mod.vectorCircleLayer(layerName, sourceId, table),
                                    source: sourceId,
                                    'source-layer': table,
                                    minzoom: 0,
                                    maxzoom: 20,
                                    layout: {},
                                    paint: {},
                                    metadata: {},
                                    filter: null
                                };
                            } else if (geometryType === 'LineString') {
                                defaultLayerDef = {
                                    ...mod.vectorLineLayer(layerName, sourceId, table),
                                    source: sourceId,
                                    'source-layer': table,
                                    minzoom: 0,
                                    maxzoom: 20,
                                    layout: {},
                                    paint: {},
                                    metadata: {},
                                    filter: null
                                };
                            } else if (geometryType === 'Polygon') {
                                defaultLayerDef = {
                                    ...mod.vectorFillLayer(layerName, sourceId, table),
                                    source: sourceId,
                                    'source-layer': table,
                                    minzoom: 0,
                                    maxzoom: 20,
                                    layout: {},
                                    paint: {},
                                    metadata: {},
                                    filter: null
                                };
                            }
                            console.log('Adding default layer:', defaultLayerDef);
                            // Optionally, add to map here if map instance is available
                            // map.addSource(sourceId, mapSource);
                            // map.addLayer(defaultLayerDef);
                        });
                        // Fetch fields for this table and store for later use
                        fetch(`/api/v1/map-data/fields/${schema}/${table}`, {
                            headers: {
                                'Authorization': `Bearer ${authToken}`
                            }
                        })
                            .then(res => res.json())
                            .then(fieldsResp => {
                                // fieldsResp is now an object with a 'fields' array
                                const fieldsArr = Array.isArray(fieldsResp.fields) ? fieldsResp.fields : [];
                                layerFields[layerName] = fieldsArr.map(f => ({
                                    value: f.name,
                                    label: f.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                                    type: f.type
                                }));
                                renderStyleDropdown();
                            });
                        // Add to UI layer list
                        layerList.push({ name: layerName, visible: true });
                        renderLayerList();
                        renderStyleDropdown();
                    }
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
    function renderLayerList() {
        const ul = sidebarContent.querySelector('#layer-list');
        ul.innerHTML = '';
        layerList.forEach((layer, idx) => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between bg-gray-100 rounded px-2 py-1';
            li.innerHTML = `
                <span class="truncate">${layer.name}</span>
                <span class="flex gap-1">
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
                layerList[idx].visible = !layerList[idx].visible;
                renderLayerList();
                renderStyleDropdown();
                console.log('Toggled layer visibility:', layerList[idx]);
            };
        });
        ul.querySelectorAll('.remove-layer-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = +btn.dataset.idx;
                const removed = layerList.splice(idx, 1)[0];
                renderLayerList();
                renderStyleDropdown();
                console.log('Removed layer:', removed);
            };
        });
    }
    // --- Style Dropdown Logic ---
    function renderStyleDropdown() {
        if (sidebarMode !== 'style') return;
        const select = sidebarContent.querySelector('#style-layer-select');
        select.innerHTML = '<option value="">Select a layer...</option>';
        layerList.forEach(layer => {
            const option = document.createElement('option');
            option.value = layer.name;
            option.textContent = layer.name;
            select.appendChild(option);
        });
        // Always render type and filter rows, even if no layer is selected
        renderLayerTypeRow(select.value);
        select.onchange = () => {
            renderLayerTypeRow(select.value);
        };
    }

    // Add a row with label and dropdown for Type and Field, always visible
    function renderLayerTypeRow(layerName) {
        // Remove previous if exists
        const prev = sidebarContent.querySelector('#layer-type-row');
        if (prev) prev.remove();
        const prevField = sidebarContent.querySelector('#layer-field-row');
        if (prevField) prevField.remove();
        // Build type row
        const row = document.createElement('div');
        row.id = 'layer-type-row';
        row.className = 'flex items-center gap-2 mt-4';
        let typeOptions = '<option value="">Select a type...</option>';
        let fieldOptions = '<option value="">Select a field...</option>';
        let fields = [];
        let sourceId = '';
        let tableName = '';
        let geometryType = 'Point';
        if (layerName && layerFields[layerName]) {
            // Unique source id for this layer
            sourceId = layerName + '-source';
            // Table name for source-layer
            tableName = layerName.split('.').pop();
            // Use stored geometry type if available
            if (layerGeometryTypes[layerName]) {
                geometryType = layerGeometryTypes[layerName];
            }
            import('/static/js/map_layers.js').then(mod => {
                const allowedTypes = mod.GEOMETRY_LAYER_TYPES[geometryType] || [];
                const typeOptions = '<option value="">Select a type...</option>' + allowedTypes.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');
                row.querySelector('#layer-type-select').innerHTML = typeOptions;
            });
            fields = layerFields[layerName];
            fieldOptions = '<option value="">Select a field...</option>' + fields.map(f => `<option value="${f.value}">${f.label}</option>`).join('');
        }
        row.innerHTML = `
            <label for="layer-type-select" class="block text-sm font-medium text-gray-700 mb-0">Type</label>
            <select id="layer-type-select" class="flex-1 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer">
                ${typeOptions}
            </select>
        `;
        // Insert after the layer select
        const layerSelectDiv = sidebarContent.querySelector('#style-layer-select').parentElement.parentElement;
        layerSelectDiv.parentNode.insertBefore(row, layerSelectDiv.nextSibling);
        // Field row
        const fieldRow = document.createElement('div');
        fieldRow.id = 'layer-field-row';
        fieldRow.className = 'flex items-center gap-2 mt-4';
        fieldRow.innerHTML = `
            <label for="layer-field-select" class="block text-sm font-medium text-gray-700 mb-0">Filter</label>
            <select id="layer-field-select" class="flex-1 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer">
                ${fieldOptions}
            </select>
        `;
        row.parentNode.insertBefore(fieldRow, row.nextSibling);
        // If a layer is selected, wire up events as before
        if (layerName && layerFields[layerName]) {
            import('/static/js/map_layers.js').then(mod => {
                // Use correct geometry type for this layer
                let geometryType = layerGeometryTypes[layerName] || 'Point';
                const allowedTypes = mod.GEOMETRY_LAYER_TYPES[geometryType] || [];
                const typeSelect = row.querySelector('#layer-type-select');
                const fieldSelect = fieldRow.querySelector('#layer-field-select');
                function getLayerFilter() {
                    const selectedField = fieldSelect.value;
                    // Only add user_id filter if present, but always allow filter dropdown
                    const hasUserId = fields.some(f => f.value === 'user_id');
                    let filter = null;
                    if (hasUserId && selectedField) {
                        filter = [
                            'all',
                            ['==', 'user_id', '<USER_ID>'],
                            ['==', selectedField, '<VALUE>']
                        ];
                    } else if (selectedField) {
                        filter = ['==', selectedField, '<VALUE>'];
                    }
                    return filter;
                }
                typeSelect.onchange = () => {
                    const type = typeSelect.value;
                    const selectedField = fieldSelect.value;
                    let layerDef;
                    // Get sourceId and table for this layer
                    const [schema, table] = layerName.split('.');
                    const sourceId = `${layerName}-source`;
                    switch (type) {
                        case 'circle':
                            layerDef = mod.vectorCircleLayer(layerName, sourceId, table); break;
                        case 'symbol':
                            layerDef = mod.vectorSymbolLayer(layerName, sourceId, table); break;
                        case 'heatmap':
                            layerDef = mod.vectorHeatmapLayer(layerName, sourceId, table); break;
                        case 'line':
                            layerDef = mod.vectorLineLayer(layerName, sourceId, table); break;
                        case 'fill':
                            layerDef = mod.vectorFillLayer(layerName, sourceId, table); break;
                        default:
                            layerDef = null
                    }
                    if (layerDef) {
                        layerDef = {
                            ...layerDef,
                            source: sourceId,
                            'source-layer': table,
                            minzoom: 0,
                            maxzoom: 20,
                            layout: {},
                            paint: {},
                            metadata: {},
                            filter: getLayerFilter()
                        };
                    }
                    console.log('Layer definition:', layerDef);
                };
                fieldSelect.onchange = typeSelect.onchange;
                // Initial log
                typeSelect.onchange();
            });
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
            option.textContent = schema;
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
    const basemapOptionsDiv = document.getElementById('basemap-options');
    // Basemap definitions
    const basemaps = [
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
            fig.innerHTML = `
                <img src="${bm.img}" alt="${bm.label}" class="w-16 h-16 object-cover rounded-lg border-2 border-transparent group-hover:border-blue-400 transition-all duration-200">
                <figcaption class="mt-1 text-xs text-gray-700">${bm.label}</figcaption>
            `;
            fig.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.map && typeof window.map.setStyle === 'function') {
                    window.map.setStyle(bm.style);
                } else if (typeof map !== 'undefined' && typeof map.setStyle === 'function') {
                    map.setStyle(bm.style);
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
});
