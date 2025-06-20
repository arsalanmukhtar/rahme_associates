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

    // Initialize sidebar toggle functionality
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const schemaSelect = document.getElementById('schema-select');
    const tableSelect = document.getElementById('table-select');
    const addLayerBtn = document.getElementById('add-layer-btn');

    let schemasAndTables = {}; // Will store the fetched schemas and their tables    // Toggle sidebar visibility with button animation
    sidebarToggle.addEventListener('click', () => {
        const isHidden = sidebar.classList.contains('translate-x-[calc(100%+1rem)]');
        sidebar.classList.toggle('translate-x-[calc(100%+1rem)]');
        
        // Toggle button position to match sidebar animation
        if (isHidden) {
            // Move button left when sidebar opens
            sidebarToggle.style.transform = 'translate(-21rem, -50%)';
            fetchSchemasAndTables();
        } else {
            // Reset button position when sidebar closes
            sidebarToggle.style.transform = 'translate(0, -50%)';
        }
    });

    // Function to fetch schemas and tables from the API
    async function fetchSchemasAndTables() {
        try {
            const response = await fetch('/api/v1/map-data/api/schemas-and-tables');
            if (!response.ok) {
                throw new Error('Failed to fetch schemas and tables');
            }
            
            schemasAndTables = await response.json();
            populateSchemaDropdown();
            
            // Enable schema select if we have schemas
            schemaSelect.disabled = Object.keys(schemasAndTables).length === 0;
            
            // Show appropriate message if no schemas available
            if (Object.keys(schemasAndTables).length === 0) {
                showMessage('No schemas available', 'warning');
            }
        } catch (error) {
            console.error('Error fetching schemas and tables:', error);
            showMessage('Error loading schemas and tables', 'error');
        }
    }

    // Populate the schema dropdown with fetched schemas
    function populateSchemaDropdown() {
        // Clear existing options except the placeholder
        schemaSelect.innerHTML = '<option value="">Select a schema...</option>';
        
        // Add new options
        Object.keys(schemasAndTables).forEach(schema => {
            const option = document.createElement('option');
            option.value = schema;
            option.textContent = schema;
            schemaSelect.appendChild(option);
        });
    }

    // Handle schema selection change
    schemaSelect.addEventListener('change', () => {
        const selectedSchema = schemaSelect.value;
        // Clear and disable table select
        tableSelect.innerHTML = '<option value="">Select a table...</option>';
        tableSelect.disabled = !selectedSchema;
        addLayerBtn.disabled = true;

        if (selectedSchema) {
            // Populate tables for selected schema
            const tables = schemasAndTables[selectedSchema] || [];
            tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table;
                option.textContent = table;
                tableSelect.appendChild(option);
            });
        }
    });

    // Handle table selection change
    tableSelect.addEventListener('change', () => {
        // Enable/disable the Add Layer button based on table selection
        addLayerBtn.disabled = !tableSelect.value;
    });

    // Handle Add Layer button click
    addLayerBtn.addEventListener('click', () => {
        const selectedSchema = schemaSelect.value;
        const selectedTable = tableSelect.value;
        
        // if (selectedSchema && selectedTable) {
        //     // Here you can implement the logic to add the layer to the map
        //     // For now, we'll just show a message
        //     showMessage(`Adding layer from ${selectedSchema}.${selectedTable}`, 'info');
        // }
    });

});
