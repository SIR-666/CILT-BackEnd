const validateCIPData = (cipData) => {
  const warnings = [];
  
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
    warnings.push(...validateBCDData(cipData));
  } else {
    warnings.push(...validateLineAData(cipData));
  }

  return warnings;
};

// Validate LINE A specific data (COP/SOP/SIP with unified time field)
const validateLineAData = (cipData) => {
  const warnings = [];

  // Validate flow rate for LINE A (12000 L/H)
  if (cipData.flowRate !== null && cipData.flowRate !== undefined) {
    const flowA = parseFloat(cipData.flowRate);
    if (!isNaN(flowA) && flowA < 12000) {
      warnings.push({
        field: 'flowRate',
        message: `Flow A is ${flowA} L/H (recommended minimum: 12000 L/H)`,
        severity: 'warning'
      });
    }
  }

  // Validate COP records with unified `time` field
  if (cipData.copRecords && cipData.copRecords.length > 0) {
    cipData.copRecords.forEach((cop, index) => {
      // Check temperature is within min/max bounds
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

      // Check unified time field requirements
      if (cop.time !== null && cop.time !== undefined) {
        const time = parseInt(cop.time);
        if (!isNaN(time)) {
          const expectedTime = cop.stepType === 'COP' ? 67 : cop.stepType === 'SOP' ? 45 : 60;
          if (time !== expectedTime) {
            warnings.push({
              field: `copRecords[${index}].time`,
              message: `${cop.stepType} time is ${time} minutes (recommended: ${expectedTime} minutes)`,
              severity: 'info'
            });
          }
        }
      }

      // Check time format (HH:mm)
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

  // Check flow rates based on specific line
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

  // Validate special records with unified `time` field
  if (cipData.specialRecords && cipData.specialRecords.length > 0) {
    cipData.specialRecords.forEach((record, index) => {
      // DRYING validation
      if (record.stepType === 'DRYING') {
        if (record.tempActual !== null && record.tempActual !== undefined) {
          const tempActual = parseFloat(record.tempActual);
          if (!isNaN(tempActual) && (tempActual < 118 || tempActual > 125)) {
            warnings.push({
              field: `specialRecords[${index}].tempActual`,
              message: `DRYING: Temperature ${tempActual}°C is outside recommended range 118-125°C`,
              severity: 'warning'
            });
          }
        }

        // Check time (recommended 57 minutes)
        if (record.time !== null && record.time !== undefined) {
          const time = parseInt(record.time);
          if (!isNaN(time) && time !== 57) {
            warnings.push({
              field: `specialRecords[${index}].time`,
              message: `DRYING time is ${time} minutes (recommended: 57 minutes)`,
              severity: 'info'
            });
          }
        }
      }

      // FOAMING validation
      if (record.stepType === 'FOAMING') {
        if (record.time !== null && record.time !== undefined) {
          const time = parseInt(record.time);
          if (!isNaN(time) && time !== 41) {
            warnings.push({
              field: `specialRecords[${index}].time`,
              message: `FOAMING time is ${time} minutes (recommended: 41 minutes)`,
              severity: 'info'
            });
          }
        }
      }

      // DISINFECT/SANITASI validation
      if (record.stepType === 'DISINFECT/SANITASI') {
        // Concentration
        if (record.concActual !== null && record.concActual !== undefined) {
          const conc = parseFloat(record.concActual);
          if (!isNaN(conc) && (conc < 0.3 || conc > 0.5)) {
            warnings.push({
              field: `specialRecords[${index}].concActual`,
              message: `DISINFECT concentration ${conc}% is outside recommended range 0.3-0.5%`,
              severity: 'warning'
            });
          }
        }

        // Temperature
        if (record.tempActual !== null && record.tempActual !== undefined) {
          const tempActual = parseFloat(record.tempActual);
          if (!isNaN(tempActual)) {
            if (cipData.line === 'LINE D') {
              if (tempActual < 20 || tempActual > 35) {
                warnings.push({
                  field: `specialRecords[${index}].tempActual`,
                  message: `DISINFECT (LINE D): Temperature ${tempActual}°C is outside recommended range 20-35°C`,
                  severity: 'warning'
                });
              }
            } else {
              // LINE B/C - exact 40°C
              if (tempActual !== 40 && (tempActual < 38 || tempActual > 42)) {
                warnings.push({
                  field: `specialRecords[${index}].tempActual`,
                  message: `DISINFECT (LINE ${cipData.line.slice(-1)}): Temperature ${tempActual}°C is not at recommended 40°C`,
                  severity: 'warning'
                });
              }
            }
          }
        }

        // Time (recommended 30 minutes)
        if (record.time !== null && record.time !== undefined) {
          const time = parseInt(record.time);
          if (!isNaN(time) && time !== 30) {
            warnings.push({
              field: `specialRecords[${index}].time`,
              message: `DISINFECT time is ${time} minutes (recommended: 30 minutes)`,
              severity: 'info'
            });
          }
        }
      }

      // Check time format (HH:mm)
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
  if (!isBCDLine) {
    // LINE A - Check flow rate (12000 L/H)
    if (cipData.flowRate !== null && cipData.flowRate !== undefined) {
      totalChecks++;
      const flowA = parseFloat(cipData.flowRate);
      if (flowA >= 12000) passedChecks++;
      else if (flowA >= 11400) warnings++; // 5% warning threshold
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
  } else {
    // BCD lines
    if (cipData.line === 'LINE D' && cipData.flowRateD !== null && cipData.flowRateD !== undefined) {
      totalChecks++;
      const flowD = parseFloat(cipData.flowRateD);
      if (flowD >= 6000) passedChecks++;
      else if (flowD >= 5700) warnings++;
    }

    if ((cipData.line === 'LINE B' || cipData.line === 'LINE C') && 
        cipData.flowRateBC !== null && cipData.flowRateBC !== undefined) {
      totalChecks++;
      const flowBC = parseFloat(cipData.flowRateBC);
      if (flowBC >= 9000) passedChecks++;
      else if (flowBC >= 8550) warnings++;
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
          if (record.concActual) {
            totalChecks++;
            const conc = parseFloat(record.concActual);
            if (conc >= 0.3 && conc <= 0.5) passedChecks++;
            else if (conc >= 0.28 && conc <= 0.52) warnings++;
          }

          if (record.tempActual) {
            totalChecks++;
            if (cipData.line === 'LINE D') {
              const status = getTemperatureComplianceStatus(record.tempActual, 20, 35);
              if (status === 'COMPLIANT') passedChecks++;
              else if (status === 'WARNING') warnings++;
            } else {
              const temp = parseFloat(record.tempActual);
              if (temp === 40) passedChecks++;
              else if (temp >= 38 && temp <= 42) warnings++;
            }
          }
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