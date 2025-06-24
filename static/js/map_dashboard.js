// static/js/map_dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // console.log('Map Dashboard loaded successfully.');

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

    // Sidebar elements
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const layerListUl = document.getElementById('layer-list');
    const mapContainer = document.getElementById('map');

    let sidebarOpen = false;

    // --- Session Timeout Configuration ---
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds (adjust as needed)
    let timeoutId; // Variable to hold our timeout ID

    // Function to display messages in the custom message box
    function showMessage(message, type = 'info', targetBox = pageMessageBox) {
        targetBox.textContent = message;
        // Reset classes to ensure proper styling from scratch
        targetBox.className = `mt-6 p-4 rounded-lg text-sm text-center font-medium`;

        // Apply type-specific classes
        if (type === 'info') {
            targetBox.classList.add('bg-blue-100', 'text-blue-800');
        } else if (type === 'success') {
            targetBox.classList.add('bg-green-100', 'text-green-800');
        } else if (type === 'error') {
            targetBox.classList.add('bg-red-100', 'text-red-800');
        } else if (type === 'warning') {
            targetBox.classList.add('bg-yellow-100', 'text-yellow-800');
        }

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
                    errorDetail = errorJson.detail || errorJson;
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
                // Log user data for debugging
                console.log(userData);
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
            style: '/static/config/style.json', // Load custom style.json for sources and tiles
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

        // console.log('Map initialized with Mapbox GL JS and user data.');

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

        // --- Sidebar Layer Management ---
        console.log('Map loaded, populating layers panel.');
        // Ensure Lucide icons are created for the newly added elements
        if (typeof lucide !== 'undefined') {
            lucide.createIcons(); // Re-create icons for new elements
        }
        populateLayerList(); // Initial population of layers
    }

    initializeMapWithUserData();

    // Function to update sidebar and map layout
    function updateSidebarLayout() {
        if (sidebarOpen) {
            sidebar.classList.remove('translate-x-full');
            sidebar.classList.add('translate-x-0');
            // Adjust the toggle button position
            sidebarToggleBtn.style.right = 'calc(24rem + 1rem)'; // 24rem (sidebar width) + 1rem (margin)
            mapContainer.classList.add('mr-96'); // Adjust map to make space, assuming 96 corresponds to sidebar width (24rem = 96px)
        } else {
            sidebar.classList.remove('translate-x-0');
            sidebar.classList.add('translate-x-full');
            // Reset the toggle button position
            sidebarToggleBtn.style.right = '1rem'; // Original right-1, 1rem looks good
            mapContainer.classList.remove('mr-96');
        }
    }

    // Toggle sidebar visibility
    sidebarToggleBtn.addEventListener('click', () => {
        sidebarOpen = !sidebarOpen;
        updateSidebarLayout();
        // If opening, populate layers
        if (sidebarOpen && map) { // Ensure map is initialized
            populateLayerList();
        }
    });

    // Initial sidebar state on page load
    updateSidebarLayout();

    // --- Layer Management Functions ---
    let mapLayers = []; // To store processed layers for sidebar

    /**
     * Groups map layers by their source, excluding raster layers, and preserves order.
     * @param {mapboxgl.Map} map - The Mapbox GL JS map instance.
     * @returns {Array<Object>} An array of grouped layer objects.
     */
    function groupLayersBySource(map) {
        const styleLayers = map.getStyle().layers;
        const grouped = {};
        const orderedSources = [];

        styleLayers.forEach(layer => {
            if (layer.type === 'raster' || !layer.source) {
                return;
            }
            if (!grouped[layer.source]) {
                grouped[layer.source] = {
                    name: layer.source,
                    layers: []
                };
                orderedSources.push(layer.source);
            }
            grouped[layer.source].layers.push({
                id: layer.id,
                type: layer.type,
                source: layer.source,
                visibility: map.getLayoutProperty(layer.id, 'visibility') || 'visible'
            });
        });

        const orderedGroupedLayers = orderedSources.map(sourceName => grouped[sourceName]);
        return orderedGroupedLayers;
    }

    function getLayerOrderForSidebar(layer) {
        // symbol/label (top), fill (middle), outline (bottom)
        if (/symbol|label/i.test(layer.id)) return 0;
        if (/fill/i.test(layer.id)) return 1;
        if (/outline/i.test(layer.id)) return 2;
        return 99;
    }
    function getLayerOrderForMap(layer) {
        // outline (bottom), fill (middle), symbol/label (top)
        if (/outline/i.test(layer.id)) return 0;
        if (/fill/i.test(layer.id)) return 1;
        if (/symbol|label/i.test(layer.id)) return 2;
        return 99;
    }

    function populateLayerList() {
        layerListUl.innerHTML = '';
        mapLayers = groupLayersBySource(map);

        mapLayers.forEach(group => {
            // Sort layers for sidebar: symbol/label (top), fill (middle), outline (bottom)
            const sortedLayers = [...group.layers].sort((a, b) => {
                // Custom order: symbol/label (top), fill (middle), outline (bottom)
                const getOrder = l => {
                    if (/symbol|label/i.test(l.id)) return 0;
                    if (/fill/i.test(l.id)) return 1;
                    if (/outline/i.test(l.id)) return 2;
                    return 99;
                };
                return getOrder(a) - getOrder(b);
            });
            // Create a parent LI for the source group itself
            const sourceGroupLi = document.createElement('li');
            sourceGroupLi.className = 'layer-group-item bg-gray-100 p-2 rounded-lg mb-2 shadow-sm';
            sourceGroupLi.setAttribute('draggable', 'true');
            sourceGroupLi.innerHTML = `
                <div class="flex items-center justify-between cursor-pointer toggle-source-group" data-source-name="${group.name}">
                    <span class="font-bold text-gray-900 capitalize flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grip-vertical drag-handle cursor-move mr-2" style="color:#222;stroke:#222;"></svg>
                        ${group.name.replace(/_/g, ' ')} Layers
                    </span>
                    <div class="flex items-center space-x-2">
                        <button class="toggle-source-visibility-btn p-1 rounded-full hover:bg-gray-200" data-source-name="${group.name}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye text-blue-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down text-gray-600 transition-transform duration-200 chevron-toggle-icon"><path d="m6 9 6 6 6-6"></path></svg>
                    </div>
                </div>
                <ul id="source-group-${group.name}" class="space-y-1 ml-4 layer-sub-list mt-2 transition-all duration-300 ease-in-out overflow-hidden max-h-screen"></ul>
            `;
            layerListUl.appendChild(sourceGroupLi);

            const subList = sourceGroupLi.querySelector(`#source-group-${group.name}`);
            let isSourceGroupVisible = true;

            sortedLayers.forEach(layer => {
                const layerLi = document.createElement('li');
                layerLi.className = 'layer-item flex items-center justify-between py-0.5 px-2 bg-white rounded-md shadow-sm text-sm';
                layerLi.setAttribute('data-layer-id', layer.id);
                layerLi.setAttribute('data-layer-type', layer.type);
                // No drag handle here
                const initialVisibility = map.getLayoutProperty(layer.id, 'visibility');
                if (initialVisibility === 'none') {
                    isSourceGroupVisible = false;
                }
                const eyeIconHtml = initialVisibility === 'none' ?
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off text-gray-400"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a1.8 1.8 0 0 1 0-.22M4.24 12.04c.1-.17.2-.33.31-.5l.09-.16c.36-.61.68-1.29.98-2.02m.09-.16A1.82 1.82 0 0 1 6 9.42"/><path d="M8.56 2.06c.32.18.66.36 1 .53M12 4c7 0 10 7 10 7a1.82 1.82 0 0 1-.22.58"/><path d="M14.56 16.56C13.9 17.2 13.06 17.7 12 18c-1.39-.38-2.45-1.12-3-2"/></svg>' :
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye text-blue-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                layerLi.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <span class="font-medium text-gray-800 layer-name">${layer.id}</span>
                    </div>
                    <button class="toggle-visibility-btn p-1 rounded-full hover:bg-gray-200" data-layer-id="${layer.id}">
                        ${eyeIconHtml}
                    </button>
                `;
                subList.appendChild(layerLi);
            });

            // Update source group eye icon based on group visibility
            const sourceGroupIconContainer = sourceGroupLi.querySelector('.toggle-source-visibility-btn');
            if (isSourceGroupVisible) {
                sourceGroupIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye text-blue-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            } else {
                sourceGroupIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off text-gray-400"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a1.8 1.8 0 0 1 0-.22M4.24 12.04c.1-.17.2-.33.31-.5l.09-.16c.36-.61.68-1.29.98-2.02m.09-.16A1.82 1.82 0 0 1 6 9.42"/><path d="M8.56 2.06c.32.18.66.36 1 .53M12 4c7 0 10 7 10 7a1.82 1.82 0 0 1-.22.58"/><path d="M14.56 16.56C13.9 17.2 13.06 17.7 12 18c-1.39-.38-2.45-1.12-3-2"/></svg>';
            }
        });

        // --- Make #layer-list scrollable and set height to 50% of sidebar, add border ---
        layerListUl.style.overflowY = 'auto';
        layerListUl.style.height = '50%';
        layerListUl.style.maxHeight = '50%';
        // layerListUl.style.border = '1px solid #e5e7eb'; // Tailwind gray-300
        layerListUl.style.borderRadius = '0.5rem'; // rounded

        // --- SortableJS for group drag (layer-group-item) ---
        new Sortable(layerListUl, {
            animation: 150,
            handle: '.layer-group-item', // Only drag using the group item itself
            draggable: '.layer-group-item',
            onEnd: handleGroupDragEnd
        });

        // --- SortableJS for each sub-list (layer group) ---
        document.querySelectorAll('.layer-sub-list').forEach(subListElement => {
            new Sortable(subListElement, {
                animation: 150,
                handle: '.drag-handle', // Only drag using the grip icon
                draggable: '.layer-item',
                onEnd: handleLayerDragEnd
            });
        });

        // Attach event listeners for individual layer toggle visibility buttons
        document.querySelectorAll('.toggle-visibility-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const layerId = event.currentTarget.dataset.layerId;
                const currentVisibility = map.getLayoutProperty(layerId, 'visibility');
                const newVisibility = currentVisibility === 'none' ? 'visible' : 'none';
                map.setLayoutProperty(layerId, 'visibility', newVisibility);

                // Update the icon
                const iconContainer = event.currentTarget;
                if (newVisibility === 'visible') {
                    iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye text-blue-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                } else {
                    iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off text-gray-400"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a1.8 1.8 0 0 1 0-.22M4.24 12.04c.1-.17.2-.33.31-.5l.09-.16c.36-.61.68-1.29.98-2.02m.09-.16A1.82 1.82 0 0 1 6 9.42"/><path d="M8.56 2.06c.32.18.66.36 1 .53M12 4c7 0 10 7 10 7a1.82 1.82 0 0 1-.22.58"/><path d="M14.56 16.56C13.9 17.2 13.06 17.7 12 18c-1.39-.38-2.45-1.12-3-2"/></svg>';
                }
                // Check if all layers in the group are now hidden/visible and update source group icon
                const parentUl = event.currentTarget.closest('.layer-sub-list');
                if (parentUl) {
                    const sourceName = parentUl.id.replace('source-group-', '');
                    const sourceGroupToggleButton = document.querySelector(`.toggle-source-visibility-btn[data-source-name="${sourceName}"]`);
                    if (sourceGroupToggleButton) {
                        const layersInGroup = Array.from(parentUl.children);
                        let allGroupLayersVisible = true;
                        layersInGroup.forEach(li => {
                            const currentLayerId = li.dataset.layerId;
                            if (map.getLayoutProperty(currentLayerId, 'visibility') === 'none') {
                                allGroupLayersVisible = false;
                            }
                        });
                        if (allGroupLayersVisible) {
                            sourceGroupToggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye text-blue-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                        } else {
                            sourceGroupToggleButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off text-gray-400"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a1.8 1.8 0 0 1 0-.22M4.24 12.04c.1-.17.2-.33.31-.5l.09-.16c.36-.61.68-1.29.98-2.02m.09-.16A1.82 1.82 0 0 1 6 9.42"/><path d="M8.56 2.06c.32.18.66.36 1 .53M12 4c7 0 10 7 10 7a1.82 1.82 0 0 1-.22.58"/><path d="M14.56 16.56C13.9 17.2 13.06 17.7 12 18c-1.39-.38-2.45-1.12-3-2"/></svg>';
                        }
                    }
                }
            });
        });

        // Attach event listeners for source group toggle visibility buttons
        document.querySelectorAll('.toggle-source-visibility-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const sourceName = event.currentTarget.dataset.sourceName;
                const subList = document.getElementById(`source-group-${sourceName}`);
                if (!subList) return;

                const layersInGroup = Array.from(subList.children);
                if (layersInGroup.length === 0) return;

                let allVisible = true;
                // Check if all layers in the group are currently visible
                layersInGroup.forEach(li => {
                    const layerId = li.dataset.layerId;
                    if (map.getLayoutProperty(layerId, 'visibility') === 'none') {
                        allVisible = false;
                    }
                });

                const newVisibility = allVisible ? 'none' : 'visible';

                layersInGroup.forEach(li => {
                    const layerId = li.dataset.layerId;
                    map.setLayoutProperty(layerId, 'visibility', newVisibility);
                    const iconContainer = li.querySelector('.toggle-visibility-btn');
                    if (newVisibility === 'visible') {
                        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye text-blue-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                    } else {
                        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off text-gray-400"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a1.8 1.8 0 0 1 0-.22M4.24 12.04c.1-.17.2-.33.31-.5l.09-.16c.36-.61.68-1.29.98-2.02m.09-.16A1.82 1.82 0 0 1 6 9.42"/><path d="M8.56 2.06c.32.18.66.36 1 .53M12 4c7 0 10 7 10 7a1.82 1.82 0 0 1-.22.58"/><path d="M14.56 16.56C13.9 17.2 13.06 17.7 12 18c-1.39-.38-2.45-1.12-3-2"/></svg>';
                    }
                });

                // Update the source group eye icon
                const sourceGroupIconContainer = event.currentTarget;
                if (newVisibility === 'visible') {
                    sourceGroupIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye text-blue-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                } else {
                    sourceGroupIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off text-gray-400"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a1.8 1.8 0 0 1 0-.22M4.24 12.04c.1-.17.2-.33.31-.5l.09-.16c.36-.61.68-1.29.98-2.02m.09-.16A1.82 1.82 0 0 1 6 9.42"/><path d="M8.56 2.06c.32.18.66.36 1 .53M12 4c7 0 10 7 10 7a1.82 1.82 0 0 1-.22.58"/><path d="M14.56 16.56C13.9 17.2 13.06 17.7 12 18c-1.39-.38-2.45-1.12-3-2"/></svg>';
                }
            });
        });

        // Attach event listeners for source group collapse/expand
        document.querySelectorAll('.toggle-source-group').forEach(button => {
            button.addEventListener('click', (event) => {
                // Prevent collapse/expand if the click was on the eye button
                if (event.target.closest('.toggle-source-visibility-btn')) {
                    return;
                }
                const sourceName = event.currentTarget.dataset.sourceName;
                const subList = document.getElementById(`source-group-${sourceName}`);
                const chevronIcon = event.currentTarget.querySelector('.chevron-toggle-icon');

                if (subList) {
                    subList.classList.toggle('max-h-0'); // Toggle collapse
                    if (subList.classList.contains('max-h-0')) {
                        chevronIcon.classList.remove('rotate-0');
                        chevronIcon.classList.add('rotate-180'); // Point up when collapsed
                    } else {
                        chevronIcon.classList.remove('rotate-180');
                        chevronIcon.classList.add('rotate-0'); // Point down when expanded
                    }
                }
            });
        });
    }

    // --- Handle group drag-and-drop ---
    function handleGroupDragEnd(event) {
        // Get the new order of group names from the DOM
        const groupOrder = Array.from(layerListUl.children)
            .filter(li => li.classList.contains('layer-group-item'))
            .map(li => li.querySelector('.toggle-source-group').dataset.sourceName);
        // Log the new group order
        console.log('New group order:', groupOrder);
        // After group drag, also update the map layer order accordingly
        reorderAllLayersOnMap();
    }

    // --- Handle layer drag-and-drop ---
    function handleLayerDragEnd(event) {
        reorderAllLayersOnMap();
    }

    // --- Reorder all layers on the map based on sidebar order ---
    function reorderAllLayersOnMap() {
        // For each group, sort for map: outline (bottom), fill (middle), symbol/label (top)
        let orderedLayerIds = [];
        Array.from(layerListUl.children).forEach(groupLi => {
            const subList = groupLi.querySelector('.layer-sub-list');
            if (subList) {
                let groupLayers = Array.from(subList.children).map(layerLi => ({
                    id: layerLi.dataset.layerId,
                    type: layerLi.dataset.layerType,
                    group: groupLi.querySelector('.toggle-source-group').dataset.sourceName
                }));
                // Custom order for map: outline (bottom), fill (middle), symbol/label (top)
                groupLayers.sort((a, b) => {
                    const getOrder = l => {
                        if (/outline/i.test(l.id)) return 0;
                        if (/fill/i.test(l.id)) return 1;
                        if (/symbol|label/i.test(l.id)) return 2;
                        return 99;
                    };
                    return getOrder(a) - getOrder(b);
                });
                orderedLayerIds.push(...groupLayers);
            }
        });
        // Reverse for Mapbox rendering
        orderedLayerIds = orderedLayerIds.reverse();
        for (let i = 0; i < orderedLayerIds.length; i++) {
            const layerId = orderedLayerIds[i].id;
            const beforeLayer = orderedLayerIds[i + 1] ? orderedLayerIds[i + 1].id : undefined;
            if (map.getLayer(layerId)) {
                map.moveLayer(layerId, beforeLayer);
            }
        }
        console.log('Mapbox layers reordered (outline/fill/symbol-label rule):', orderedLayerIds.map(l => l.id));
    }

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
        // Log the presence of user_id
        console.log({ hasUserId });

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
                    // console.log('Created user_id filter:', filter);
                } else {
                    console.error('Failed to fetch user data for filter, status:', userResp.status);
                    return null; // Return null if we can't get the user ID - this prevents showing data without proper filtering
                }
            } catch (e) {
                console.error('Error fetching user data for filter:', e);
                return null; // Return null if we can't get the user ID - this prevents showing data without proper filtering
            }
        }
        return filter;
    }
});
