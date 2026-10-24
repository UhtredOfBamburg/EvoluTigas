const fs = require('fs');

function generateCurve(ageStart, ageEnd, steps, metricGenerator) {
    const data = [];
    for (let i = 0; i <= steps; i++) {
        const age = ageStart + (ageEnd - ageStart) * (i / steps);
        const metrics = metricGenerator(age);
        data.push({ age, ...metrics });
    }
    return data;
}

// Age is in months
function boysWeight0to5(age) {
    const p50 = 3.3 + (15 * age / (age + 15));
    return { p3: p50 * 0.75, p15: p50 * 0.85, p50, p85: p50 * 1.15, p97: p50 * 1.25 };
}
function boysHeight0to5(age) {
    const p50 = 50 + (60 * age / (age + 20));
    return { p3: p50 - 4, p15: p50 - 2, p50, p85: p50 + 2, p97: p50 + 4 };
}
function girlsWeight0to5(age) {
    const p50 = 3.2 + (14.5 * age / (age + 15));
    return { p3: p50 * 0.75, p15: p50 * 0.85, p50, p85: p50 * 1.15, p97: p50 * 1.25 };
}
function girlsHeight0to5(age) {
    const p50 = 49 + (59 * age / (age + 20));
    return { p3: p50 - 4, p15: p50 - 2, p50, p85: p50 + 2, p97: p50 + 4 };
}

// Age is in years for 5-19
function boysWeight5to19(age) {
    const p50 = 18.3 + (50 * Math.pow((age-5)/14, 1.5));
    return { p3: p50 * 0.7, p15: p50 * 0.85, p50, p85: p50 * 1.15, p97: p50 * 1.3 };
}
function boysHeight5to19(age) {
    const p50 = 110 + (66 * ((age-5)/14));
    return { p3: p50 - 8, p15: p50 - 4, p50, p85: p50 + 4, p97: p50 + 8 };
}
function girlsWeight5to19(age) {
    const p50 = 18 + (40 * Math.pow((age-5)/14, 1.3));
    return { p3: p50 * 0.7, p15: p50 * 0.85, p50, p85: p50 * 1.15, p97: p50 * 1.3 };
}
function girlsHeight5to19(age) {
    // Girls stop growing earlier
    const progress = Math.min((age-5)/10, 1);
    const p50 = 109 + (54 * Math.sin(progress * Math.PI / 2));
    return { p3: p50 - 7, p15: p50 - 3.5, p50, p85: p50 + 3.5, p97: p50 + 7 };
}

const charts = {
    boys0to5: {
        weight: generateCurve(0, 60, 60, boysWeight0to5),
        height: generateCurve(0, 60, 60, boysHeight0to5)
    },
    girls0to5: {
        weight: generateCurve(0, 60, 60, girlsWeight0to5),
        height: generateCurve(0, 60, 60, girlsHeight0to5)
    },
    boys5to19: {
        weight: generateCurve(5, 19, 14, boysWeight5to19),
        height: generateCurve(5, 19, 14, boysHeight5to19)
    },
    girls5to19: {
        weight: generateCurve(5, 19, 14, girlsWeight5to19),
        height: generateCurve(5, 19, 14, girlsHeight5to19)
    }
};

fs.mkdirSync('src/lib', { recursive: true });
fs.writeFileSync('src/lib/pediatricCharts.json', JSON.stringify(charts, null, 2));
console.log('done');
