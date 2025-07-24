const validateCIPData = (cipData) => {
    const errors = [];
    
    // Check if this is a BCD line
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(cipData.line);

    // Validate CIP steps (same for all lines)
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

    // Validate based on line type
    if (isBCDLine) {
        // Validate BCD specific data
        errors.push(...validateBCDData(cipData));
    } else {
        // Validate LINE A specific data (COP records)
        errors.push(...validateLineAData(cipData));
    }

    return errors;
};

// Validate LINE A specific data
const validateLineAData = (cipData) => {
    const errors = [];

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

// Validate BCD specific data
const validateBCDData = (cipData) => {
    const errors = [];

    // Validate flow rates based on specific line
    if (cipData.line === 'LINE D') {
        if (cipData.flowRateD !== null && cipData.flowRateD !== undefined) {
            const flowD = parseFloat(cipData.flowRateD);
            if (!isNaN(flowD) && flowD < 6000) {
                errors.push({
                    field: 'flowRateD',
                    message: 'Flow D must be minimum 6000 L/H'
                });
            }
        }
    } else if (cipData.line === 'LINE B' || cipData.line === 'LINE C') {
        if (cipData.flowRateBC !== null && cipData.flowRateBC !== undefined) {
            const flowBC = parseFloat(cipData.flowRateBC);
            if (!isNaN(flowBC) && flowBC < 9000) {
                errors.push({
                    field: 'flowRateBC',
                    message: 'Flow B,C must be minimum 9000 L/H'
                });
            }
        }
    }

    // Validate special records
    if (cipData.specialRecords && cipData.specialRecords.length > 0) {
        cipData.specialRecords.forEach((record, index) => {
            // Validate DRYING
            if (record.stepType === 'DRYING') {
                if (record.tempActual !== null && record.tempActual !== undefined) {
                    const temp = parseFloat(record.tempActual);
                    if (!isNaN(temp) && (temp < 118 || temp > 125)) {
                        errors.push({
                            field: `specialRecords[${index}].tempActual`,
                            message: 'DRYING temperature must be between 118°C and 125°C'
                        });
                    }
                }

                if (record.time !== 57) {
                    errors.push({
                        field: `specialRecords[${index}].time`,
                        message: 'DRYING time should be 57 minutes'
                    });
                }
            }

            // Validate FOAMING
            if (record.stepType === 'FOAMING') {
                if (record.time !== 41) {
                    errors.push({
                        field: `specialRecords[${index}].time`,
                        message: 'FOAMING time should be 41 minutes'
                    });
                }
            }

            // Validate DISINFECT/SANITASI
            if (record.stepType === 'DISINFECT/SANITASI') {
                // Validate concentration
                if (record.concActual !== null && record.concActual !== undefined) {
                    const conc = parseFloat(record.concActual);
                    if (!isNaN(conc) && (conc < 0.3 || conc > 0.5)) {
                        errors.push({
                            field: `specialRecords[${index}].concActual`,
                            message: 'DISINFECT/SANITASI concentration must be between 0.3% and 0.5%'
                        });
                    }
                }

                // Validate temperature based on line
                if (record.tempActual !== null && record.tempActual !== undefined) {
                    const temp = parseFloat(record.tempActual);
                    if (cipData.line === 'LINE D') {
                        if (!isNaN(temp) && (temp < 20 || temp > 35)) {
                            errors.push({
                                field: `specialRecords[${index}].tempActual`,
                                message: 'DISINFECT/SANITASI temperature for LINE D must be between 20°C and 35°C'
                            });
                        }
                    } else {
                        // LINE B or C
                        if (!isNaN(temp) && temp !== 40) {
                            errors.push({
                                field: `specialRecords[${index}].tempActual`,
                                message: 'DISINFECT/SANITASI temperature for LINE B/C must be 40°C'
                            });
                        }
                    }
                }

                if (record.time !== 30) {
                    errors.push({
                        field: `specialRecords[${index}].time`,
                        message: 'DISINFECT/SANITASI time should be 30 minutes'
                    });
                }
            }

            // Validate time format (HH:mm)
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (record.startTime && !timeRegex.test(record.startTime)) {
                errors.push({
                    field: `specialRecords[${index}].startTime`,
                    message: `${record.stepType}: Invalid start time format. Use HH:mm`
                });
            }
            if (record.endTime && !timeRegex.test(record.endTime)) {
                errors.push({
                    field: `specialRecords[${index}].endTime`,
                    message: `${record.stepType}: Invalid end time format. Use HH:mm`
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
    
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(cipData.line);

    // Check steps (same for all lines)
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

    // Check line-specific records
    if (isBCDLine) {
        // Check flow rates based on specific line
        if (cipData.line === 'LINE D' && cipData.flowRateD !== null && cipData.flowRateD !== undefined) {
            totalChecks++;
            const flowD = parseFloat(cipData.flowRateD);
            if (flowD >= 6000) passedChecks++;
            else if (flowD >= 5700) warnings++; // 5% warning threshold
        }

        if ((cipData.line === 'LINE B' || cipData.line === 'LINE C') && 
            cipData.flowRateBC !== null && cipData.flowRateBC !== undefined) {
            totalChecks++;
            const flowBC = parseFloat(cipData.flowRateBC);
            if (flowBC >= 9000) passedChecks++;
            else if (flowBC >= 8550) warnings++; // 5% warning threshold
        }

        // Check special records
        if (cipData.specialRecords && cipData.specialRecords.length > 0) {
            cipData.specialRecords.forEach(record => {
                if (record.stepType === 'DRYING' && record.tempActual) {
                    totalChecks++;
                    const status = getTemperatureComplianceStatus(record.tempActual, 118, 125);
                    if (status === 'COMPLIANT') passedChecks++;
                    else if (status === 'WARNING') warnings++;
                }

                if (record.stepType === 'DISINFECT/SANITASI') {
                    // Check concentration
                    if (record.concActual) {
                        totalChecks++;
                        const conc = parseFloat(record.concActual);
                        if (conc >= 0.3 && conc <= 0.5) passedChecks++;
                        else if (conc >= 0.28 && conc <= 0.52) warnings++;
                    }

                    // Check temperature
                    if (record.tempActual) {
                        totalChecks++;
                        if (cipData.line === 'LINE D') {
                            const status = getTemperatureComplianceStatus(record.tempActual, 20, 35);
                            if (status === 'COMPLIANT') passedChecks++;
                            else if (status === 'WARNING') warnings++;
                        } else {
                            // LINE B or C - exact 40°C
                            const temp = parseFloat(record.tempActual);
                            if (temp === 40) passedChecks++;
                            else if (temp >= 38 && temp <= 42) warnings++;
                        }
                    }
                }
            });
        }
    } else {
        // Check COP records for LINE A
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
    validateLineAData,
    validateBCDData,
    getTemperatureComplianceStatus,
    calculateComplianceScore
};