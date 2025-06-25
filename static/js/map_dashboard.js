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
    const mapContainer = document.getElementById('map');
    let sidebarOpen = false;

    // Toggle sidebar visibility
    sidebarToggleBtn.addEventListener('click', () => {
        sidebarOpen = !sidebarOpen;
        if (sidebarOpen) {
            sidebar.classList.remove('translate-x-full');
            sidebar.classList.add('translate-x-0');
            sidebar.classList.add('mr-2'); // Add mr-2 when open
            // Adjust the toggle button position for new width (18rem)
            sidebarToggleBtn.style.right = 'calc(18rem + 1rem)';
            mapContainer.classList.add('mr-[18rem]');
        } else {
            sidebar.classList.remove('translate-x-0');
            sidebar.classList.add('translate-x-full');
            sidebar.classList.remove('mr-2'); // Remove mr-2 when closed
            sidebarToggleBtn.style.right = '1rem';
            mapContainer.classList.remove('mr-[18rem]');
        }
    });
    // Initial sidebar state on page load
    if (sidebarOpen) {
        sidebar.classList.remove('translate-x-full');
        sidebar.classList.add('translate-x-0');
        sidebar.classList.add('mr-2');
        sidebarToggleBtn.style.right = 'calc(18rem + 1rem)';
        mapContainer.classList.add('mr-[18rem]');
    } else {
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('translate-x-full');
        sidebar.classList.remove('mr-2');
        sidebarToggleBtn.style.right = '1rem';
        mapContainer.classList.remove('mr-[18rem]');
    }

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

        // Wait for map to load and all style layers to be loaded, then log all layer ids
        function logAllLayerIdsWhenLoaded(map) {
            if (!map) return;
            map.on('load', function() {
                // Wait for all sources to be loaded
                const checkSourcesLoaded = () => {
                    const style = map.getStyle();
                    if (!style || !style.sources) return false;
                    for (const sourceId in style.sources) {
                        const source = map.getSource(sourceId);
                        if (!source || !source.loaded || (typeof source.loaded === 'function' && !source.loaded())) {
                            return false;
                        }
                    }
                    return true;
                };
                // Poll until all sources are loaded
                const poll = setInterval(() => {
                    if (checkSourcesLoaded()) {
                        clearInterval(poll);
                        // All sources loaded, now log all layer ids
                        const layerIds = map.getStyle().layers.map(l => l.id);
                        console.log('All style layers loaded. Layer IDs:', layerIds);
                    }
                }, 100);
            });
        }
        logAllLayerIdsWhenLoaded(map);

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

        // --- Minimal Layers Panel in Sidebar ---
        // Only sidebar toggle and minimal panel remain
        sidebar.innerHTML = `
            <div class="p-4">
                <h2 class="text-lg font-semibold mb-2">Layers Panel</h2>
                <hr class="mb-2">
            </div>
        `;

        // --- Basemap Switcher Logic (moved inside map init) ---
        // Dynamically detect basemap layers (those with 'basemap' in their id and type 'raster')
        let basemapLayers = [];
        function detectBasemapLayers() {
            if (!map || !map.getStyle) return [];
            const style = map.getStyle();
            if (!style || !style.layers) return [];
            // Find all raster layers with 'basemap' in their id
            return style.layers
                .filter(l => l.type === 'raster' && l.id.toLowerCase().includes('basemap'))
                .map(l => ({ id: l.id, name: l.id.replace(/-?basemap/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || 'Basemap' }));
        }

        // DOM elements
        const basemapSwitcherBtn = document.getElementById('basemap-switcher-btn');
        const basemapSwitcherDropdown = document.getElementById('basemap-switcher-dropdown');
        const basemapSwitcherLabel = document.getElementById('basemap-switcher-label');

        // Helper to get current basemap (topmost visible basemap layer)
        function getCurrentBasemapId() {
            for (let i = basemapLayers.length - 1; i >= 0; i--) {
                const layer = map.getLayer(basemapLayers[i].id);
                if (layer && map.getLayoutProperty(layer.id, 'visibility') !== 'none') {
                    return layer.id;
                }
            }
            return basemapLayers[0]?.id;
        }

        // Render dropdown options
        function renderBasemapOptions() {
            const menu = basemapSwitcherDropdown.querySelector('.py-1');
            menu.innerHTML = '';
            basemapLayers.forEach(basemap => {
                const option = document.createElement('button');
                option.className = 'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-100 transition-colors duration-150 flex items-center';
                option.textContent = basemap.name;
                option.setAttribute('role', 'menuitem');
                option.dataset.basemapId = basemap.id;
                if (getCurrentBasemapId() === basemap.id) {
                    option.classList.add('font-bold', 'text-blue-700');
                }
                option.addEventListener('click', () => {
                    setBasemap(basemap.id);
                    basemapSwitcherDropdown.classList.add('hidden');
                });
                menu.appendChild(option);
            });
        }

        // Set the picked basemap visible, others hidden, and move it last in style order
        function setBasemap(basemapId) {
            // Hide all basemaps
            basemapLayers.forEach(b => {
                if (map.getLayer(b.id)) {
                    map.setLayoutProperty(b.id, 'visibility', 'none');
                }
            });
            // Show picked basemap
            if (map.getLayer(basemapId)) {
                map.setLayoutProperty(basemapId, 'visibility', 'visible');
            }
            // Move picked basemap to last in style order
            const allLayerIds = map.getStyle().layers.map(l => l.id);
            let lastBasemapIdx = -1;
            for (let i = allLayerIds.length - 1; i >= 0; i--) {
                if (basemapLayers.some(b => b.id === allLayerIds[i])) {
                    lastBasemapIdx = i;
                    break;
                }
            }
            if (lastBasemapIdx !== -1 && map.getLayer(basemapId)) {
                map.moveLayer(basemapId);
            }
            // Update label
            const picked = basemapLayers.find(b => b.id === basemapId);
            basemapSwitcherLabel.textContent = picked ? picked.name : 'Change Basemap';
            renderBasemapOptions();
        }

        // Dropdown open/close logic
        basemapSwitcherBtn.addEventListener('click', () => {
            if (basemapLayers.length === 0) {
                basemapLayers = detectBasemapLayers();
            }
            basemapSwitcherDropdown.classList.toggle('hidden');
            renderBasemapOptions();
        });
        // Hide dropdown on click outside
        document.addEventListener('mousedown', (e) => {
            if (!basemapSwitcherBtn.contains(e.target) && !basemapSwitcherDropdown.contains(e.target)) {
                basemapSwitcherDropdown.classList.add('hidden');
            }
        });

        // On map load, detect basemaps, set initial basemap and label
        map.on('load', () => {
            basemapLayers = detectBasemapLayers();
            if (basemapLayers.length > 0) {
                setBasemap(basemapLayers[basemapLayers.length - 1].id);
            } else {
                // If no basemaps found, show a disabled option
                const menu = basemapSwitcherDropdown.querySelector('.py-1');
                menu.innerHTML = '<div class="px-4 py-2 text-gray-400">No basemaps found</div>';
                basemapSwitcherLabel.textContent = 'No Basemaps';
            }
        });
    }

    // Initialize the map with user data
    initializeMapWithUserData();

    // --- Offers Table Logic ---
    const offersTableContainer = document.getElementById('offers-table-container');
    const offersTableChevron = document.getElementById('offers-table-chevron');
    const offersAgGridDiv = document.getElementById('offers-ag-grid');
    const offersTableToggleBtn = document.getElementById('toggle-offers-table');
    let offersTableOpen = false;
    let offersGrid;

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
});