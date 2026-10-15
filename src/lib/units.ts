/**
 * Units are never inferred from column names alone.
 * Convert only when required additional information is supplied explicitly.
 */
function finite(value: number,name: string): void {
  if (!Number.isFinite(value)) throw new Error(name + " must be finite.");
}
function positive(value: number,name: string): void {
  finite(value,name);
  if (value <= 0) throw new Error(name + " must be positive.");
}
export function kelvinToCelsius(value: number): number {
  finite(value,"kelvin");
  if (value < 0) throw new Error("Temperature below absolute zero.");
  return value - 273.15;
}
export function celsiusToKelvin(value: number): number {
  finite(value,"celsius");
  if (value < -273.15) throw new Error("Temperature below absolute zero.");
  return value + 273.15;
}
export function secondsToMinutes(value: number): number {
  finite(value,"seconds"); return value/60;
}
export function hoursToMinutes(value: number): number {
  finite(value,"hours"); return value*60;
}
export function kelvinPerHourToCelsiusPerMinute(value: number): number {
  finite(value,"cooling rate"); return value/60;
}
export function molarityToGramPerMl(value: number, molarMassGramPerMol: number): number {
  finite(value,"molarity"); positive(molarMassGramPerMol,"molar mass");
  if (value < 0) throw new Error("Negative concentration.");
  return value * molarMassGramPerMol / 1000;
}
/** Density is the full solution density in g/mL, not the solvent density. */
export function massPercentToGramPerMl(massPercent: number, solutionDensityGramPerMl: number): number {
  finite(massPercent,"mass percent"); positive(solutionDensityGramPerMl,"solution density");
  if (massPercent < 0 || massPercent > 100) throw new Error("Mass percent outside 0–100.");
  return massPercent/100 * solutionDensityGramPerMl;
}
/** The atmospheric reference MUST be supplied; never assume a universal +1 bar. */
export function barGaugeToAbsolute(gaugeBar: number, referenceAtmosphereBar: number): number {
  finite(gaugeBar,"gauge pressure"); positive(referenceAtmosphereBar,"reference atmosphere");
  const absolute = gaugeBar + referenceAtmosphereBar;
  if (absolute < 0) throw new Error("Negative absolute pressure.");
  return absolute;
}
export function barToMPa(bar: number): number {
  finite(bar,"pressure"); return bar*0.1;
}
