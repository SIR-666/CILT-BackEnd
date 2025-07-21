const validateCIPData = (cipData) => {
    const errors = [];

    // Validate CIP steps
    if (cipData.steps && cipData.steps.length > 0) {
        cipData.steps.forEach((step, index) => {
            // Validate temperature is within min/max bounds
            if (step.temperatureActual !== null && step.temperatureActual !== undefined) {
                const tempActual = parseFloat(step.temperatureActual);
                const tempMin = parseFloat(step.temperatureSetpointMin);
                const tempMax = parseFloat(step.temperatureSetpointMax);

                if (!isNaN(tempActual) && !isNaN(tempMin) && !isNaN(tempMax)) {
                    if (tempActual < tempMin || tempActual > tempMax) {
                        errors.push({
                            field: `steps[${index}].temperatureActual`,
                            message: `Step ${step.stepNumber} (${step.stepName}): Temperature ${tempActual}°C is outside allowed range ${tempMin}°C - ${tempMax}°C`
                        });
                    }
                }
            }

            // Validate concentration for ALKALI and ACID
            if (step.stepName === 'ALKALI' && step.concentrationActual !== null && step.concentrationActual !== undefined) {
                const conc = parseFloat(step.concentrationActual);
                if (!isNaN(conc)) {
                    if (conc < 1.5 || conc > 2.0) {
                        errors.push({
                            field: `steps[${index}].concentrationActual`,
                            message: `ALKALI concentration ${conc}% is outside allowed range 1.5% - 2.0%`
                        });
                    }
                }
            }

            if (step.stepName === 'ACID' && step.concentrationActual !== null && step.concentrationActual !== undefined) {
                const conc = parseFloat(step.concentrationActual);
                if (!isNaN(conc)) {
                    if (conc < 0.5 || conc > 1.0) {
                        errors.push({
                            field: `steps[${index}].concentrationActual`,
                            message: `ACID concentration ${conc}% is outside allowed range 0.5% - 1.0%`
                        });
                    }
                }
            }

            // Validate time format (HH:mm)
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (step.startTime && !timeRegex.test(step.startTime)) {
                errors.push({
                    field: `steps[${index}].startTime`,
                    message: `Step ${step.stepNumber}: Invalid start time format. Use HH:mm`
                });
            }
            if (step.endTime && !timeRegex.test(step.endTime)) {
                errors.push({
                    field: `steps[${index}].endTime`,
                    message: `Step ${step.stepNumber}: Invalid end time format. Use HH:mm`
                });
            }
        });
    }

    // Validate COP records
    if (cipData.copRecords && cipData.copRecords.length > 0) {
        cipData.copRecords.forEach((cop, index) => {
            // Validate temperature is within min/max bounds
            if (cop.tempActual !== null && cop.tempActual !== undefined) {
                const tempActual = parseFloat(cop.tempActual);
                const tempMin = parseFloat(cop.tempMin);
                const tempMax = parseFloat(cop.tempMax);

                if (!isNaN(tempActual) && !isNaN(tempMin) && !isNaN(tempMax)) {
                    if (tempActual < tempMin || tempActual > tempMax) {
                        errors.push({
                            field: `copRecords[${index}].tempActual`,
                            message: `${cop.stepType}: Temperature ${tempActual}°C is outside allowed range ${tempMin}°C - ${tempMax}°C`
                        });
                    }
                }
            }

            // Validate specific time requirements
            if (cop.stepType === 'COP' && cop.time67Min) {
                const time = parseInt(cop.time67Min);
                if (!isNaN(time) && time !== 67) {
                    errors.push({
                        field: `copRecords[${index}].time67Min`,
                        message: `COP time should be 67 minutes`
                    });
                }
            }

            if (cop.stepType === 'SOP' && cop.time45Min) {
                const time = parseInt(cop.time45Min);
                if (!isNaN(time) && time !== 45) {
                    errors.push({
                        field: `copRecords[${index}].time45Min`,
                        message: `SOP time should be 45 minutes`
                    });
                }
            }

            if (cop.stepType === 'SIP' && cop.time60Min) {
                const time = parseInt(cop.time60Min);
                if (!isNaN(time) && time !== 60) {
                    errors.push({
                        field: `copRecords[${index}].time60Min`,
                        message: `SIP time should be 60 minutes`
                    });
                }
            }

            // Validate time format (HH:mm)
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (cop.startTime && !timeRegex.test(cop.startTime)) {
                errors.push({
                    field: `copRecords[${index}].startTime`,
                    message: `${cop.stepType}: Invalid start time format. Use HH:mm`
                });
            }
            if (cop.endTime && !timeRegex.test(cop.endTime)) {
                errors.push({
                    field: `copRecords[${index}].endTime`,
                    message: `${cop.stepType}: Invalid end time format. Use HH:mm`
                });
            }
        });
    }

    return errors;
};

// Helper function to get temperature compliance status
const getTemperatureComplianceStatus = (actual, min, max) => {
    const tempActual = parseFloat(actual);
    const tempMin = parseFloat(min);
    const tempMax = parseFloat(max);

    if (isNaN(tempActual) || isNaN(tempMin) || isNaN(tempMax)) {
        return 'INVALID';
    }

    if (tempActual < tempMin || tempActual > tempMax) {
        return 'OUT_OF_RANGE';
    }

    // Check if temperature is within warning threshold (5% of range)
    const range = tempMax - tempMin;
    const warningThreshold = range * 0.05;

    if (tempActual <= tempMin + warningThreshold || tempActual >= tempMax - warningThreshold) {
        return 'WARNING';
    }

    return 'COMPLIANT';
};

// Function to calculate CIP report compliance score
const calculateComplianceScore = (cipData) => {
    let totalChecks = 0;
    let passedChecks = 0;
    let warnings = 0;

    // Check steps
    if (cipData.steps && cipData.steps.length > 0) {
        cipData.steps.forEach(step => {
            if (step.temperatureActual !== null && step.temperatureActual !== undefined) {
                totalChecks++;
                const status = getTemperatureComplianceStatus(
                    step.temperatureActual,
                    step.temperatureSetpointMin,
                    step.temperatureSetpointMax
                );
                if (status === 'COMPLIANT') passedChecks++;
                else if (status === 'WARNING') warnings++;
            }

            // Check concentration for ALKALI and ACID
            if ((step.stepName === 'ALKALI' || step.stepName === 'ACID') && step.concentrationActual) {
                totalChecks++;
                const conc = parseFloat(step.concentrationActual);
                if (step.stepName === 'ALKALI') {
                    if (conc >= 1.5 && conc <= 2.0) passedChecks++;
                    else if (conc >= 1.4 && conc <= 2.1) warnings++;
                } else if (step.stepName === 'ACID') {
                    if (conc >= 0.5 && conc <= 1.0) passedChecks++;
                    else if (conc >= 0.4 && conc <= 1.1) warnings++;
                }
            }
        });
    }

    // Check COP records
    if (cipData.copRecords && cipData.copRecords.length > 0) {
        cipData.copRecords.forEach(cop => {
            if (cop.tempActual !== null && cop.tempActual !== undefined) {
                totalChecks++;
                const status = getTemperatureComplianceStatus(
                    cop.tempActual,
                    cop.tempMin,
                    cop.tempMax
                );
                if (status === 'COMPLIANT') passedChecks++;
                else if (status === 'WARNING') warnings++;
            }
        });
    }

    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    
    return {
        score,
        totalChecks,
        passedChecks,
        failedChecks: totalChecks - passedChecks - warnings,
        warnings,
        status: score >= 95 ? 'EXCELLENT' : score >= 80 ? 'GOOD' : score >= 60 ? 'ACCEPTABLE' : 'POOR'
    };
};

module.exports = {
    validateCIPData,
    getTemperatureComplianceStatus,
    calculateComplianceScore
};