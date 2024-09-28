async function fetchHorizonsData(des,startTime, stopTime, stepSize = '1d') {
    const url = "/api/horizons";
    const params = new URLSearchParams({
        'format': 'json',
        'COMMAND': `'DES=${des};'`,
        'OBJ_DATA': 'YES',
        'MAKE_EPHEM': 'YES',
        'EPHEM_TYPE': 'OBSERVER',
        'CENTER': '500@399',  // Changed to Earth-centered observer
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
    
    const dates = [], ra = [], dec = [];
    for (let i = startIdx; i < endIdx; i++) {
        const parts = lines[i].trim().split(/\s+/);
        dates.push(parts[0]);
        ra.push(parts.slice(2, 5).join(' '));  // Preserve full precision
        dec.push(parts.slice(5, 8).join(' ')); // Preserve full precision
    }

    
    
    return { dates, ra, dec };
}

function convertToCartesian(ra, dec) {
    // Convert RA (HH MM SS.ff) to degrees
    const [raH, raM, raS] = ra.split(' ').map(Number);
    const raDeg = (raH + raM/60 + raS/3600) * 15;  // 15 degrees per hour

    // Convert Dec (DD MM SS.f) to degrees
    const [decD, decM, decS] = dec.split(' ').map(Number);
    const decDeg = Math.sign(decD) * (Math.abs(decD) + decM/60 + decS/3600);

    // Convert to radians
    const raRad = raDeg * Math.PI / 180;
    const decRad = decDeg * Math.PI / 180;

    // Convert to Cartesian coordinates
    const x = Math.cos(decRad) * Math.cos(raRad);
    const y = Math.cos(decRad) * Math.sin(raRad);
    const z = Math.sin(decRad);

    return { x, y, z };
}

async function getTrajectoryDataForDES(des, startTime, stopTime) {
    const data = await fetchHorizonsData(des, startTime, stopTime);
    if (data) {
        const { dates, ra, dec } = parseHorizonsData(data);
        const cartesianCoords = ra.map((_, i) => convertToCartesian(ra[i], dec[i]));
        
        return {
            des,
            dates,
            x: cartesianCoords.map(coord => coord.x),
            y: cartesianCoords.map(coord => coord.y),
            z: cartesianCoords.map(coord => coord.z)
        };
    } else {
        console.error(`Failed to fetch trajectory data for DES ${des}`);
        return null;
    }
}
// Example usage (you'll need to adapt this to your specific plotting library)
// async function plotTrajectory() {
//     const trajectoryData = await getTrajectoryData();
//     if (trajectoryData) {
//         // Use your preferred JavaScript plotting library here
//         // For example, if using Plotly.js:
//         /*
//         Plotly.newPlot('plotDiv', [{
//             type: 'scatter3d',
//             mode: 'lines',
//             x: trajectoryData.x,
//             y: trajectoryData.y,
//             z: trajectoryData.z,
//             line: {color: 'blue'}
//         }], {
//             title: "Asteroid 54481740 Trajectory (2006-01-01 to 2007-01-20)",
//             scene: {
//                 xaxis: {title: 'X'},
//                 yaxis: {title: 'Y'},
//                 zaxis: {title: 'Z'}
//             }
//         });
//         */
//         console.log("Trajectory data ready for plotting:", trajectoryData);
//     } else {
//         console.error("Failed to plot trajectory data");
//     }
// }

// plotTrajectory();