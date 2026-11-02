/**
 * BigSolDB v2.2 companion protocol cross-reference, OFFLINE.
 *
 * Source: https://zenodo.org/records/22648301 (published 2026-09-07).
 * Companion methods: 10 columns; solid forms: 15 columns.
 * Cross-reference is by DOI and exact CAS/SMILES/solid-form label.
 *
 * This does NOT authenticate original publications, lab protocol, file
 * rights, or physical material model accuracy. Caller must verify source
 * bytes/rights separately. In particular the BigSolDB "mol/L" derivative
 * uses L of PURE SOLVENT, not L of solution: we never import it.
 */
import { readCsvTable } from "../../scripts/import-bigsoldb21";

export const BIGSOLDB22_PROTOCOL_VERSION="crystaltwin-bigsoldb22-protocol/1" as const;
const METHODS=[
  "doi","solubility_type","method","equilibration_h","settling_h",
  "agitation_type","agitation_rpm","temperature_control","pressure_kPa","replicates",
] as const;
const FORMS=[
  "doi","CAS","SMILES_Solute","solid_form_label","solute_purity",
  "purity_method","solute_supplier","solid_phase_control",
  "phase_change_observed","solid_form","melting_point_K",
  "melting_point_method","decomposition_temperature_K",
  "fusion_enthalpy_kJ_mol","fusion_enthalpy_source",
] as const;
function exactTable(csv:string,headers:readonly string[],name:string){
  const rows=readCsvTable(csv);
  const actual=rows.shift()!;
  if(actual.length!==headers.length||headers.some((h,i)=>h!==actual[i]))
    throw new Error(name+" exact official header names and order required.");
  return rows.map((row,index)=>Object.fromEntries(headers.map((h,i)=>[h,row[i]]))
    as Record<typeof headers[number],string>);
}
function finiteOptional(value:string,label:string):number|null{
  if(value.trim()==="")return null;
  const v=Number(value);
  if(!Number.isFinite(v)||v<0)throw new Error("Invalid "+label+" metadata.");
  return v;
}
export type ProtocolSelection={
  doi:string;
  cas:string;
  smilesSolute:string;
  solidFormLabel:string;
};
export function auditBigSolDB22SourceProtocol(
  methodsCSV:string,
  formsCSV:string,
  selection:ProtocolSelection,
){
  const doi=selection.doi.trim().toLowerCase();
  if(!/^10\.\d{4,9}\/\S+$/.test(doi))throw new Error("Valid exact DOI required.");
  for(const [key,value] of Object.entries(selection)){
    if(key==="doi")continue;
    if(!value || !value.trim() || value.length>300)
      throw new Error("Explicit CAS, solute SMILES and solid-form label are required, not inferred.");
  }
  const methods=exactTable(methodsCSV,METHODS,"methods");
  const forms=exactTable(formsCSV,FORMS,"solid_forms");
  const article=methods.filter(r=>r.doi.toLowerCase()===doi);
  if(article.length!==1)throw new Error("Exactly one method record per source article DOI required.");
  const method=article[0];
  const target=forms.filter(r=>r.doi.toLowerCase()===doi &&
    r.CAS===selection.cas &&
    r.SMILES_Solute===selection.smilesSolute &&
    r.solid_form_label===selection.solidFormLabel);
  if(target.length!==1)throw new Error("Ambiguous or missing exact DOI/CAS/SMILES/solid-form match.");
  const form=target[0];
  const reportedReplicates=finiteOptional(method.replicates,"replicates");
  if(reportedReplicates!==null&&!Number.isInteger(reportedReplicates))
    throw new Error("Replicates must be an integer.");
  const equilibrationHours=finiteOptional(method.equilibration_h,"equilibration_h");
  const settlingHours=finiteOptional(method.settling_h,"settling_h");
  const purity=finiteOptional(form.solute_purity,"solute_purity");
  if(purity!==null&&purity>1)throw new Error("Purity must be a fraction <= 1.");
  const stablePhase=form.phase_change_observed==="none";
  const instrumentCharacterized=["xrd_before_after","dsc_before_after"].includes(form.solid_phase_control);
  const equilibriumProtocol=method.solubility_type==="equilibrium";
  const flags=[
    ...(!equilibriumProtocol?["NOT_CONFIRMED_EQUILIBRIUM"]:[]),
    ...(method.method===""||method.method==="not_reported"?["UNKNOWN_MEASUREMENT_METHOD"]:[]),
    ...(!stablePhase?["SOLID_PHASE_NOT_CONFIRMED_STABLE"]:[]),
    ...(!instrumentCharacterized?["LIMITED_SOLID_PHASE_CHARACTERIZATION"]:[]),
    ...(reportedReplicates===null?["REPLICATES_UNSPECIFIED"]:[]),
    ...(equilibrationHours===null?["EQUILIBRATION_TIME_UNSPECIFIED"]:[]),
  ];
  return{
    version:BIGSOLDB22_PROTOCOL_VERSION,
    origin:"published_dataset_companion_tables_not_authenticated_primary_data" as const,
    verifiedExactJoinKeys:{
      doi,cas:selection.cas,smilesSolute:selection.smilesSolute,solidFormLabel:selection.solidFormLabel,
    },
    publishedMethod:{
      solubilityType:method.solubility_type,
      method:method.method,
      equilibrationHours,settlingHours,
      agitationType:method.agitation_type,
      agitationRpm:finiteOptional(method.agitation_rpm,"agitation_rpm"),
      temperatureControl:method.temperature_control,
      reportedReplicates,
    },
    reportedForm:{
      formClass:form.solid_form,
      solidPhaseControl:form.solid_phase_control,
      phaseChangeObserved:form.phase_change_observed,
      solutePurityFraction:purity,
    },
    comparabilityGate:{
      eligibleForFurtherReview:equilibriumProtocol&&stablePhase&&instrumentCharacterized&&
        method.method!==""&&method.method!=="not_reported",
      certifiedForPhysicalModelValidation:false as const,
      originalLabDataAuthenticated:false as const,
      auxiliaryCsvBytesAuthenticated:false as const,
      flags,
    },
    unitWarning:"The v2.2 Solubility(mol/L) is moles per L of pure solvent, not solution; NO mass or molarity conversion performed.",
    citation:"BigSolDB v2.2, https://doi.org/10.5281/zenodo.22648301",
  };
}
