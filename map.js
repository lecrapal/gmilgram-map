const FRANCE_BOUNDS = [
    [41.3, -5.1],  // Sud-Ouest
    [51.1, 9.5]    // Nord-Est
];

const geoJSONUrls = {
    france: './maps/france.geojson',
    abies_alba: './maps/carte_abies_alba.geojson',
    quercus_petrae: './maps/carte_quercus_petrae.geojson',
    quercus_pube: './maps/carte_quercus_pube.geojson',
    quercus_robur: './maps/carte_quercus_robur.geojson',
    vaccinium: './maps/carte_vaccinium.geojson'
};

let geoJSONLayers = {};
let map;

function loadGeoJSONAndInitMap() {
    const promises = Object.entries(geoJSONUrls).map(([key, url]) =>
        fetch(url)
            .then(response => response.json())
            .then(data => {
                geoJSONLayers[key] = L.geoJSON(data, {
                    style: {
                        fillColor: 'transparent',
                        color: key === 'france' ? '#3388ff' : getRandomColor(),
                        weight: 2
                    }
                });
            })
    );

    return Promise.all(promises);
}

function getRandomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16);
}

function initMap() {
    map = L.map('map').setView([46.8, 2.8], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    console.log(geoJSONLayers);

    for (let layer of Object.keys(geoJSONLayers)) {
        geoJSONLayers[layer].addTo(map);
    }

    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            displayCoordinates();
        });
    });

}

function isValidGeometry(geom) {
    return geom && geom.type && (geom.type === 'Polygon' || geom.type === 'MultiPolygon');
}

function intersectWithFrance(bounds) {
    const rectangle = turf.bboxPolygon([
        bounds.getWest(), bounds.getSouth(),
        bounds.getEast(), bounds.getNorth()
    ]);

    const france = geoJSONLayers.france.toGeoJSON().features[0];

    try {
        return turf.intersect(rectangle, france);
    } catch (error) {
        console.error("Erreur lors de l'intersection avec la France:", error);
        return null;
    }
}

function filterIntersectionBySpecies(intersection, selectedSpecies) {
    if (selectedSpecies.length === 0 || !isValidGeometry(intersection.geometry)) return intersection;

    let filteredPolygon = intersection;
    for (let species of selectedSpecies) {
        const speciesPolygon = geoJSONLayers[species].toGeoJSON().features[0];
        if (!isValidGeometry(speciesPolygon.geometry)) {
            console.error(`Géométrie invalide pour ${species}`);
            continue;
        }
        try {
            const newIntersection = turf.intersect(filteredPolygon, speciesPolygon);
            if (newIntersection && isValidGeometry(newIntersection.geometry)) {
                filteredPolygon = newIntersection;
            } else {
                console.log(`Pas d'intersection valide avec ${species}`);
            }
        } catch (error) {
            console.error(`Erreur lors de l'intersection avec ${species}:`, error);
        }
    }

    return isValidGeometry(filteredPolygon.geometry) ? filteredPolygon : null;
}

function isPointInPolygon(coord, polygon) {
    if (!polygon || !polygon.geometry) return false;
    const point = turf.point([coord[1], coord[0]]);
    try {
        return turf.booleanPointInPolygon(point, polygon);
    } catch (error) {
        console.error("Erreur lors de la vérification du point dans le polygone:", error);
        return false;
    }
}

function processCoordinates() {
    const inputs = document.querySelectorAll('#latlng input[type="text"]');
    let values = Array.from(inputs).map(input => input.value.trim());

    let emptyCount = values.filter(v => v === '').length;

    if (emptyCount > 4) {
        let minLat = '', maxLat = '', minLng = '', maxLng = '';

        for (let i = 0; i < 8; i++) {
            if (i === 2) { minLat += '.'; maxLat += '.'; }
            if (values[i] === '') { minLat += '0'; maxLat += '9'; }
            else { minLat += values[i]; maxLat += values[i]; }
        }

        for (let i = 8; i < 15; i++) {
            if (i === 9) { minLng += '.'; maxLng += '.'; }
            if (values[i] === '') { minLng += '0'; maxLng += '9'; }
            else { minLng += values[i]; maxLng += values[i]; }
        }

        return {
            coordinates: [
                [parseFloat(minLat), parseFloat(minLng)],
                [parseFloat(maxLat), parseFloat(maxLng)]
            ],
            emptyCount: emptyCount
        };
    } else {
        let latParts = values.slice(0, 8);
        let lngParts = values.slice(8, 15);

        function generateCombinations(parts) {
            let result = [''];
            for (let part of parts) {
                if (part === '') {
                    let newResult = [];
                    for (let r of result) {
                        for (let i = 0; i <= 9; i++) {
                            newResult.push(r + i);
                        }
                    }
                    result = newResult;
                } else {
                    result = result.map(r => r + part);
                }
            }
            return result;
        }

        let latCombos = generateCombinations(latParts);
        let lngCombos = generateCombinations(lngParts);

        let coordinates = [];
        for (let lat of latCombos) {
            for (let lng of lngCombos) {
                coordinates.push([
                    parseFloat(lat.slice(0, 2) + '.' + lat.slice(2)),
                    parseFloat(lng.slice(0, 1) + '.' + lng.slice(1))
                ]);
            }
        }

        return { coordinates, emptyCount };
    }
}

function displayCoordinates() {
    const { coordinates, emptyCount } = processCoordinates();
    const selectedSpecies = Array.from(document.querySelectorAll('input[name="species"]:checked')).map(cb => cb.value);

    map.eachLayer(layer => {
        if (layer instanceof L.Rectangle || layer instanceof L.Marker || layer instanceof L.Polygon) {
            map.removeLayer(layer);
        }
    });

    let bounds = L.latLngBounds(coordinates);
    const intersection = intersectWithFrance(bounds);

    if (intersection) {
        let filteredIntersection = filterIntersectionBySpecies(intersection, selectedSpecies);

        if (filteredIntersection) {
            const intersectionLayer = L.geoJSON(filteredIntersection).addTo(map);

            if (emptyCount < 4) {
                coordinates.forEach(coord => {
                    if (isPointInPolygon(coord, filteredIntersection)) {
                        L.marker(coord).addTo(map)
                            .bindPopup(`${coord[0].toFixed(6)}, ${coord[1].toFixed(5)}`);
                    }
                });
            } else {
                intersectionLayer.setStyle({
                    color: "#ff7800",
                    weight: 1,
                    fillOpacity: 0.4
                }).bindPopup(`Zone des coordonnées possibles`);
            }

            map.fitBounds(intersectionLayer.getBounds());
        } else {
            console.log("Aucune intersection valide avec les espèces sélectionnées");
            map.fitBounds(geoJSONLayers.france.getBounds());
        }
    } else {
        console.log("Aucune intersection valide avec la France");
        map.fitBounds(geoJSONLayers.france.getBounds());
    }
}

loadGeoJSONAndInitMap().then(initMap);