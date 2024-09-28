async function fetchHorizonsData(startTime, stopTime, stepSize = '1d') {
    const url = "/api/horizons";
    const params = new URLSearchParams({
        'format': 'json',
        'COMMAND': "'DES=54481740;'",
        'OBJ_DATA': 'YES',
        'MAKE_EPHEM': 'YES',
        'EPHEM_TYPE': 'OBSERVER',
        'CENTER': '500@0',
        'START_TIME': startTime,
        'STOP_TIME': stopTime,
        'STEP_SIZE': stepSize,
        'QUANTITIES': '1'
    });

    try {
        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch data from Horizons API:", error);
        return null;
    }
}

function parseHorizonsData(data) {
    const lines = data.result.split('\n');
    const startIdx = lines.findIndex(line => line.includes('$$SOE')) + 1;
    const endIdx = lines.findIndex(line => line.includes('$$EOE'));
    
    const dates = [], x = [], y = [], z = [];
    for (let i = startIdx; i < endIdx; i++) {
        const parts = lines[i].trim().split(/\s+/);
        dates.push(parts[0]);
        x.push(parseFloat(parts[2]));
        y.push(parseFloat(parts[3]));
        z.push(parseFloat(parts[4]));
    }
    
    console.log("Parsed data:", { dates, x, y, z });
    return { dates, x, y, z };
}

function convertToCartesian(ra, dec) {
    const x = Math.cos(dec * Math.PI / 180) * Math.cos(ra * Math.PI / 180);
    const y = Math.cos(dec * Math.PI / 180) * Math.sin(ra * Math.PI / 180);
    const z = Math.sin(dec * Math.PI / 180);
    return { x, y, z };
}

async function getTrajectoryData() {
    const data = await fetchHorizonsData('2023-01-01', '2023-06-01');
    if (data) {
        const parsedData = parseHorizonsData(data);
        console.log("Parsed trajectory data:", parsedData);
        return parsedData;
    } else {
        console.error("Failed to fetch trajectory data");
        return null;
    }
}
