const speciesColors = {
    myrtilles: '#464196',
    sapins: '#01796f',
    forets_mixtes: '#72601b',
};

const geoJSONUrls = {
    france: './maps/france.geojson',
    myrtilles: './maps/myrtilles.geojson',
    sapins: './maps/sapins.geojson',
    forets_mixtes: './maps/forets_mixtes.geojson',
};

let geoJSONLayers = {};
let geoJSONFeatures = {};
let map;

const loadGeoJSONAndInitMap = async () => {
    const entries = Object.entries(geoJSONUrls);
    await Promise.all(
        entries.map(async ([key, url]) => {
            const response = await fetch(url);
            const data = await response.json();
            const color = key === 'france' ? '#3388ff' : speciesColors[key];
            geoJSONFeatures[key] = data;
            geoJSONLayers[key] = L.geoJSON(data, {
                style: {
                    fillColor: color,
                    fillOpacity: 0.2,
                    color: color,
                    weight: 2,
                },
            });
            if (key !== 'france') setupCheckbox(key, color);
        })
    );
    // add event on france checkbox
    document.querySelector('input[name="france"]').addEventListener('change', updateMapLayers);
};

const setupCheckbox = (key, color) => {
    const checkbox = document.querySelector(`input[name="species"][value="${key}"]`);
    if (checkbox) {
        const speciesItem = checkbox.closest('.species-item');
        speciesItem.style.backgroundColor = `${color}33`;
        const checkmark = checkbox.nextElementSibling;
        checkmark.style.borderColor = color;
        checkbox.addEventListener('change', (event) => updateCheckboxAppearance(event.target, color));
        updateCheckboxAppearance(checkbox, color);
    }
};


const updateCheckboxAppearance = (checkbox, color) => {
    const checkmark = checkbox.nextElementSibling;
    checkmark.style.backgroundColor = checkbox.checked ? color : '#e0e0e0';
    checkmark.style.borderColor = color;
};

const handleSelectAll = (event) => {
    const isChecked = event.target.checked;
    document.querySelectorAll('input[name="species"]').forEach(checkbox => {
        checkbox.checked = isChecked;
        updateCheckboxAppearance(checkbox, speciesColors[checkbox.value]);
    });
    updateMapLayers();
};


const initMap = () => {
    map = L.map('map').setView([46.8, 2.8], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', event => {
            event.preventDefault();
            filterCoordinates();
        });
    });

    document.querySelectorAll('input[name="species"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateMapLayers);
    });

    document.getElementById('select-all').addEventListener('change', handleSelectAll);
};


const isPointInZone = (coord) => {
    const point = turf.point([coord[1], coord[0]]); // Note: turf utilise [lng, lat]
    if (document.querySelector('input[name="france"]').checked) {
        if (!turf.booleanPointInPolygon(point, geoJSONFeatures.france.features[0].geometry)) {
            return false;
        }
    }

    const selectedSpecies = Array.from(document.querySelectorAll('input[name="species"]:checked')).map(cb => cb.value);

    // Multiple features intersection
    for (const species of selectedSpecies) {
        const features = geoJSONLayers[species].toGeoJSON().features;
        if (features.some(feature => turf.booleanPointInPolygon(point, feature.geometry))) {
            return true;
        }
    }

    return false;
};


const clearMapLayers = () => {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Rectangle || layer instanceof L.GeoJSON)
        {

            map.removeLayer(layer)
        }
    });
};


const updateMapLayers = () => {

    clearMapLayers();

    // Si france est coché, on l'affiche
    if (document.querySelector('input[name="france"]').checked) {
        geoJSONLayers.france.addTo(map);
    }

    const selectedSpecies = Array.from(document.querySelectorAll('input[name="species"]:checked')).map(cb => cb.value);

    selectedSpecies.forEach(species => geoJSONLayers[species].addTo(map));

    const visibleLayers = selectedSpecies.map(species => geoJSONLayers[species]);
    if (visibleLayers.length > 0) {
        const group = L.featureGroup(visibleLayers);
        map.fitBounds(group.getBounds());
    } else {
        map.fitBounds(geoJSONLayers.france.getBounds());
    }
}

// On va faire l'intersection entre le rectangle et les species (et la france si franceIntersection est défini)
const intersectWithSpecies = (bounds, franceIntersection) => {
    let intersection = turf.bboxPolygon([
        bounds.getWest(), bounds.getSouth(),
        bounds.getEast(), bounds.getNorth()
    ]);

    if (franceIntersection) {
        intersection = franceIntersection;
    }

    const selectedSpecies = Array.from(document.querySelectorAll('input[name="species"]:checked')).map(cb => cb.value);
    if(selectedSpecies.length > 0) {
        let allSpeciesUnion;
        selectedSpecies.forEach(species => {
            const speciesLayer = geoJSONLayers[species];

            let speciesUnion;
            const features = speciesLayer.toGeoJSON().features;

            // Multiple features intersection
            for (let i = 0; i < features.length; i++) {
                const feature = features[i];
                const speciesFeatureIntersection = turf.intersect(intersection, feature);

                if (speciesFeatureIntersection) {
                    if (!speciesUnion) {
                        speciesUnion = speciesFeatureIntersection;
                    } else {
                        speciesUnion = turf.union(speciesUnion, speciesFeatureIntersection);
                    }
                }
            }
            if (!allSpeciesUnion && speciesUnion) {
                allSpeciesUnion = speciesUnion;
            } else {
                allSpeciesUnion = turf.intersect(allSpeciesUnion, speciesUnion);
            }
        });

        intersection = allSpeciesUnion;
    }

    return intersection;
};
const filterCoordinates = () => {

    clearMapLayers();

    const { coordinates, emptyCount } = processCoordinates();

    let bounds = L.latLngBounds(coordinates);

    let intersection;
    // si france est checké
    if (document.querySelector('input[name="france"]').checked) {
        intersection = intersectWithFrance(bounds);
    }

    // si les checkbox des espèces sont checkées, on fait l'intersection sur chacune d'entre elles, en + de la france si elle est checkée
    if(document.querySelectorAll('input[name="species"]:checked').length > 0) {
        intersection = intersectWithSpecies(bounds, intersection);
    }

    if (intersection) {
        const intersectionLayer = L.geoJSON(intersection).addTo(map);

        if (emptyCount < 4) {
            // S'il y a moins de 4 inputs vides, afficher des points
            coordinates.forEach(coord => {
                if (isPointInZone(coord)) {
                    L.marker(coord).addTo(map)
                        .bindPopup(`${coord[0].toFixed(6)}, ${coord[1].toFixed(5)}`);
                }
            });
        } else {
            // S'il y a 4 inputs vides ou plus, afficher le polygone d'intersection
            intersectionLayer.setStyle({
                color: "#ff7800",
                weight: 1,
                fillOpacity: 0.4
            }).bindPopup(`Zone des coordonnées possibles en France`);
        }

        // Ajuster la vue de la carte
        map.fitBounds(intersectionLayer.getBounds());

    } else {
        // Ajouter le rectangle sur la carte
        L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(map);
        // Ajuster la vue de la carte
        map.fitBounds(bounds);

    }
};

function intersectWithFrance(bounds) {
    const rectangle = turf.bboxPolygon([
        bounds.getWest(), bounds.getSouth(),
        bounds.getEast(), bounds.getNorth()
    ]);

    const france = geoJSONFeatures.france.features[0];
    return turf.intersect(rectangle, france);
}


const processCoordinates = () => {
    const inputs = document.querySelectorAll('#latlng input[type="text"]');
    const values = Array.from(inputs).map(input => input.value.trim());
    const emptyCount = values.filter(v => v === '').length;

    return emptyCount > 4 ? processRangeCoordinates(values) : processExactCoordinates(values);
};

const processRangeCoordinates = (values) => {
    const [minLat, maxLat] = processLatitudeParts(values.slice(0, 8));
    const [minLng, maxLng] = processLongitudeParts(values.slice(8));

    return {
        coordinates: [
            [parseFloat(minLat), parseFloat(minLng)],
            [parseFloat(maxLat), parseFloat(maxLng)]
        ],
        emptyCount: values.filter(v => v === '').length
    };
};

const processLatitudeParts = (parts) => {
    return parts.reduce(([min, max], value, index) => {
        if (index === 2) {
            min += '.';
            max += '.';
        }
        if (value === '') {
            min += '0';
            max += '9';
        } else {
            min += value;
            max += value;
        }
        return [min, max];
    }, ['', '']);
};

const processLongitudeParts = (parts) => {
    return parts.reduce(([min, max], value, index) => {
        if (index === 1) {
            min += '.';
            max += '.';
        }
        if (value === '') {
            min += '0';
            max += '9';
        } else {
            min += value;
            max += value;
        }
        return [min, max];
    }, ['', '']);
};

const processExactCoordinates = (values) => {
    const latParts = values.slice(0, 8);
    const lngParts = values.slice(8);

    const latCombos = generateCombinations(latParts);
    const lngCombos = generateCombinations(lngParts);

    const coordinates = latCombos.flatMap(lat =>
        lngCombos.map(lng => [
            parseFloat(lat.slice(0, 2) + '.' + lat.slice(2)),
            parseFloat(lng.slice(0, 1) + '.' + lng.slice(1))
        ])
    );

    return { coordinates, emptyCount: values.filter(v => v === '').length };
};

const generateCombinations = (parts) => {
    return parts.reduce((acc, part) => {
        if (part === '') {
            return acc.flatMap(r => Array.from({length: 10}, (_, i) => r + i));
        } else {
            return acc.map(r => r + part);
        }
    }, ['']);
};

loadGeoJSONAndInitMap().then(initMap);
