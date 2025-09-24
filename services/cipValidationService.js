const validateCIPData = (cipData) => {
    const warnings = [];
    
    // Check if this is a BCD line
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(cipData.line);

    // Validate CIP steps (same for all lines)
    if (cipData.steps && cipData.steps.length > 0) {
        cipData.steps.forEach((step, index) => {
            // Check temperature is within min/max bounds - WARNING ONLY
            if (step.temperatureActual !== null && step.temperatureActual !== undefined) {
                const tempActual = parseFloat(step.temperatureActual);
                const tempMin = parseFloat(step.temperatureSetpointMin);
                const tempMax = parseFloat(step.temperatureSetpointMax);

                if (!isNaN(tempActual) && !isNaN(tempMin) && !isNaN(tempMax)) {
                    if (tempActual < tempMin || tempActual > tempMax) {
                        warnings.push({
                            field: `steps[${index}].temperatureActual`,
                            message: `Step ${step.stepNumber} (${step.stepName}): Temperature ${tempActual}°C is outside recommended range ${tempMin}°C - ${tempMax}°C`,
                            severity: 'warning'
                        });
                    }
                }
            }

            // Check concentration for ALKALI and ACID - WARNING ONLY
            if (step.stepName === 'ALKALI' && step.concentrationActual !== null && step.concentrationActual !== undefined) {
                const conc = parseFloat(step.concentrationActual);
                if (!isNaN(conc)) {
                    if (conc < 1.5 || conc > 2.0) {
                        warnings.push({
                            field: `steps[${index}].concentrationActual`,
                            message: `ALKALI concentration ${conc}% is outside recommended range 1.5% - 2.0%`,
                            severity: 'warning'
                        });
                    }
                }
            }

            if (step.stepName === 'ACID' && step.concentrationActual !== null && step.concentrationActual !== undefined) {
                const conc = parseFloat(step.concentrationActual);
                if (!isNaN(conc)) {
                    if (conc < 0.5 || conc > 1.0) {
                        warnings.push({
                            field: `steps[${index}].concentrationActual`,
                            message: `ACID concentration ${conc}% is outside recommended range 0.5% - 1.0%`,
                            severity: 'warning'
                        });
                    }
                }
            }

            // Check time format (HH:mm) - WARNING ONLY
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (step.startTime && !timeRegex.test(step.startTime)) {
                warnings.push({
                    field: `steps[${index}].startTime`,
                    message: `Step ${step.stepNumber}: Start time format should be HH:mm (e.g., 09:30)`,
                    severity: 'info'
                });
            }
            if (step.endTime && !timeRegex.test(step.endTime)) {
                warnings.push({
                    field: `steps[${index}].endTime`,
                    message: `Step ${step.stepNumber}: End time format should be HH:mm (e.g., 10:30)`,
                    severity: 'info'
                });
            }
        });
    }

    // Validate based on line type
    if (isBCDLine) {
        // Validate BCD specific data
        warnings.push(...validateBCDData(cipData));
    } else {
        // Validate LINE A specific data (COP records)
        warnings.push(...validateLineAData(cipData));
    }

    return warnings;
};

// Validate LINE A specific data
const validateLineAData = (cipData) => {
    const warnings = [];

    // Validate COP records - WARNING ONLY
    if (cipData.copRecords && cipData.copRecords.length > 0) {
        cipData.copRecords.forEach((cop, index) => {
            // Check temperature is within min/max bounds - WARNING ONLY
            if (cop.tempActual !== null && cop.tempActual !== undefined) {
                const tempActual = parseFloat(cop.tempActual);
                const tempMin = parseFloat(cop.tempMin);
                const tempMax = parseFloat(cop.tempMax);

                if (!isNaN(tempActual) && !isNaN(tempMin) && !isNaN(tempMax)) {
                    if (tempActual < tempMin || tempActual > tempMax) {
                        warnings.push({
                            field: `copRecords[${index}].tempActual`,
                            message: `${cop.stepType}: Temperature ${tempActual}°C is outside recommended range ${tempMin}°C - ${tempMax}°C`,
                            severity: 'warning'
                        });
                    }
                }
            }

            // Check specific time requirements - INFO ONLY (not strict)
            if (cop.stepType === 'COP' && cop.time67Min) {
                const time = parseInt(cop.time67Min);
                if (!isNaN(time) && time !== 67) {
                    warnings.push({
                        field: `copRecords[${index}].time67Min`,
                        message: `COP time is ${time} minutes (recommended: 67 minutes)`,
                        severity: 'info'
                    });
                }
            }

            if (cop.stepType === 'SOP' && cop.time45Min) {
                const time = parseInt(cop.time45Min);
                if (!isNaN(time) && time !== 45) {
                    warnings.push({
                        field: `copRecords[${index}].time45Min`,
                        message: `SOP time is ${time} minutes (recommended: 45 minutes)`,
                        severity: 'info'
                    });
                }
            }

            if (cop.stepType === 'SIP' && cop.time60Min) {
                const time = parseInt(cop.time60Min);
                if (!isNaN(time) && time !== 60) {
                    warnings.push({
                        field: `copRecords[${index}].time60Min`,
                        message: `SIP time is ${time} minutes (recommended: 60 minutes)`,
                        severity: 'info'
                    });
                }
            }

            // Check time format (HH:mm) - INFO ONLY
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (cop.startTime && !timeRegex.test(cop.startTime)) {
                warnings.push({
                    field: `copRecords[${index}].startTime`,
                    message: `${cop.stepType}: Start time format should be HH:mm (e.g., 09:30)`,
                    severity: 'info'
                });
            }
            if (cop.endTime && !timeRegex.test(cop.endTime)) {
                warnings.push({
                    field: `copRecords[${index}].endTime`,
                    message: `${cop.stepType}: End time format should be HH:mm (e.g., 10:30)`,
                    severity: 'info'
                });
            }
        });
    }

    return warnings;
};

// Validate BCD specific data
const validateBCDData = (cipData) => {
    const warnings = [];

    // Check flow rates based on specific line - WARNING ONLY
    if (cipData.line === 'LINE D') {
        if (cipData.flowRateD !== null && cipData.flowRateD !== undefined) {
            const flowD = parseFloat(cipData.flowRateD);
            if (!isNaN(flowD) && flowD < 6000) {
                warnings.push({
                    field: 'flowRateD',
                    message: `Flow D is ${flowD} L/H (recommended minimum: 6000 L/H)`,
                    severity: 'warning'
                });
            }
        }
    } else if (cipData.line === 'LINE B' || cipData.line === 'LINE C') {
        if (cipData.flowRateBC !== null && cipData.flowRateBC !== undefined) {
            const flowBC = parseFloat(cipData.flowRateBC);
            if (!isNaN(flowBC) && flowBC < 9000) {
                warnings.push({
                    field: 'flowRateBC',
                    message: `Flow B,C is ${flowBC} L/H (recommended minimum: 9000 L/H)`,
                    severity: 'warning'
                });
            }
        }
    }

    // Validate special records - WARNING ONLY
    if (cipData.specialRecords && cipData.specialRecords.length > 0) {
        cipData.specialRecords.forEach((record, index) => {
            // Check DRYING - WARNING ONLY
            if (record.stepType === 'DRYING') {
                if (record.tempActual !== null && record.tempActual !== undefined) {
                    const temp = parseFloat(record.tempActual);
                    if (!isNaN(temp) && (temp < 118 || temp > 125)) {
                        warnings.push({
                            field: `specialRecords[${index}].tempActual`,
                            message: `DRYING temperature is ${temp}°C (recommended range: 118°C - 125°C)`,
                            severity: 'warning'
                        });
                    }
                }

                if (record.time && record.time !== 57) {
                    warnings.push({
                        field: `specialRecords[${index}].time`,
                        message: `DRYING time is ${record.time} minutes (recommended: 57 minutes)`,
                        severity: 'info'
                    });
                }
            }

            // Check FOAMING - INFO ONLY
            if (record.stepType === 'FOAMING') {
                if (record.time && record.time !== 41) {
                    warnings.push({
                        field: `specialRecords[${index}].time`,
                        message: `FOAMING time is ${record.time} minutes (recommended: 41 minutes)`,
                        severity: 'info'
                    });
                }
            }

            // Check DISINFECT/SANITASI - WARNING ONLY
            if (record.stepType === 'DISINFECT/SANITASI') {
                // Check concentration
                if (record.concActual !== null && record.concActual !== undefined) {
                    const conc = parseFloat(record.concActual);
                    if (!isNaN(conc) && (conc < 0.3 || conc > 0.5)) {
                        warnings.push({
                            field: `specialRecords[${index}].concActual`,
                            message: `DISINFECT/SANITASI concentration is ${conc}% (recommended range: 0.3% - 0.5%)`,
                            severity: 'warning'
                        });
                    }
                }

                // Check temperature based on line
                if (record.tempActual !== null && record.tempActual !== undefined) {
                    const temp = parseFloat(record.tempActual);
                    if (cipData.line === 'LINE D') {
                        if (!isNaN(temp) && (temp < 20 || temp > 35)) {
                            warnings.push({
                                field: `specialRecords[${index}].tempActual`,
                                message: `DISINFECT/SANITASI temperature for LINE D is ${temp}°C (recommended range: 20°C - 35°C)`,
                                severity: 'warning'
                            });
                        }
                    } else {
                        // LINE B or C
                        if (!isNaN(temp) && temp !== 40) {
                            warnings.push({
                                field: `specialRecords[${index}].tempActual`,
                                message: `DISINFECT/SANITASI temperature for LINE B/C is ${temp}°C (recommended: 40°C)`,
                                severity: 'warning'
                            });
                        }
                    }
                }

                if (record.time && record.time !== 30) {
                    warnings.push({
                        field: `specialRecords[${index}].time`,
                        message: `DISINFECT/SANITASI time is ${record.time} minutes (recommended: 30 minutes)`,
                        severity: 'info'
                    });
                }
            }

            // Check time format (HH:mm) - INFO ONLY
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (record.startTime && !timeRegex.test(record.startTime)) {
                warnings.push({
                    field: `specialRecords[${index}].startTime`,
                    message: `${record.stepType}: Start time format should be HH:mm (e.g., 09:30)`,
                    severity: 'info'
                });
            }
            if (record.endTime && !timeRegex.test(record.endTime)) {
                warnings.push({
                    field: `specialRecords[${index}].endTime`,
                    message: `${record.stepType}: End time format should be HH:mm (e.g., 10:30)`,
                    severity: 'info'
                });
            }
        });
    }

    return warnings;
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
        status: score >= 95 ? 'EXCELLENT' : score >= 80 ? 'GOOD' : score >= 60 ? 'ACCEPTABLE' : 'NEEDS_ATTENTION'
    };
};

// Helper function to categorize warnings by severity
const categorizeWarnings = (warnings) => {
    const categorized = {
        critical: warnings.filter(w => w.severity === 'critical'),
        warning: warnings.filter(w => w.severity === 'warning'),
        info: warnings.filter(w => w.severity === 'info')
    };
    
    return categorized;
};

// Helper function to get warning summary
const getWarningSummary = (warnings) => {
    const categorized = categorizeWarnings(warnings);
    
    return {
        total: warnings.length,
        critical: categorized.critical.length,
        warning: categorized.warning.length,
        info: categorized.info.length,
        hasBlockingIssues: categorized.critical.length > 0,
        message: warnings.length === 0 
            ? "All parameters are within recommended ranges" 
            : `Found ${warnings.length} validation notice(s): ${categorized.critical.length} critical, ${categorized.warning.length} warnings, ${categorized.info.length} info`
    };
};

module.exports = {
    validateCIPData,
    validateLineAData,
    validateBCDData,
    getTemperatureComplianceStatus,
    calculateComplianceScore,
    categorizeWarnings,
    getWarningSummary
};