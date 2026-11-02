/**
 * BigSolDB v2.2 OFFLINE intake: verify exact bytes against the official
 * GitHub Git blob SHA before interpreting the source CSV. No automatic
 * internet fetch, file redistribution, density conversion, calibration,
 * original-paper authentication or claims of verified crystallization kinetics.
 *
 * Official source: levakrasnovs/BigSolDBv2.0
 * Pinned commit: 6a6072d6825112c7d55e79c03ceb724739d956ab
 * Git tree: BigSolDBv2.2.csv blob SHA1 0108873f585dae3700923367b59030e002ac71f5
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { readCsvTable } from "./import-bigsoldb21";
import { parseResearchDataset, type ResearchDataset } from "../src/lib/research-schema";

export const BIGSOLDB22_SOURCE = {
  githubRepository:"levakrasnovs/BigSolDBv2.0",
  commit:"6a6072d6825112c7d55e79c03ceb724739d956ab",
  filename:"BigSolDBv2.2.csv",
  gitBlobSha1:"0108873f585dae3700923367b59030e002ac71f5",
  sizeBytes:24678209,
  rawUrl:"https://raw.githubusercontent.com/levakrasnovs/BigSolDBv2.0/6a6072d6825112c7d55e79c03ceb724739d956ab/BigSolDBv2.2.csv",
} as const;

export interface BigSolDB22Selection {
  compound: string;
  solvent: string;
  doi: string;
  /** Explicit column mapping only; guessed semantics are forbidden. */
  methodColumn?: string;
  solidFormColumn?: string;
  /** Required if selected rows contain >1 distinct method or solid form. */
  methodValue?: string;
  solidFormValue?: string;
}

export interface SourceEvidence {
  gitBlobSha1: string;
  sha256: string;
  byteLength: number;
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Git blob hash: SHA-1("blob <size>\0" || exact bytes), NOT SHA-1(bytes). */
export function calculateGitBlobSha1(bytes: Uint8Array): string {
  return createHash("sha1").update("blob " + bytes.byteLength + "\0")
    .update(bytes).digest("hex");
}

export function attestBigSolDB22Source(bytes: Uint8Array): SourceEvidence {
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==BIGSOLDB22_SOURCE.sizeBytes)
    throw new Error("Official BigSolDB v2.2 CSV byte length mismatch.");
  const gitBlobSha1=calculateGitBlobSha1(bytes);
  if(gitBlobSha1!==BIGSOLDB22_SOURCE.gitBlobSha1)
    throw new Error("Official BigSolDB v2.2 Git blob SHA-1 mismatch.");
  return {gitBlobSha1,sha256:sha256(bytes),byteLength:bytes.byteLength};
}

const REQUIRED=[
  "Temperature_K","Solubility(mole_fraction)","Compound_Name","Solvent",
  "SMILES_Solute","SMILES_Solvent","Source",
] as const;
const DOI=/^10\.\d{4,9}\/\S+$/i;
function nonempty(value:string, name:string,limit=160):string {
  if(typeof value!=="string"||!value.trim()||value.length>limit)
    throw new Error(name+" must be nonempty and at most "+limit+" characters.");
  return value.trim();
}
function hasMappedColumn(column:string|undefined,header:readonly string[],label:string){
  if(!column) return null;
  const name=nonempty(column,label,120);
  // v2.2 mol/L is moles per L of PURE SOLVENT, not solution; numerical
  // concentration and log columns are never measurement protocol labels.
  if(["Solubility(mol/L)","LogS(mol/L)","LogS(mole_fraction)","CAS",
      "PubChem_CID","FDA_Approved"].includes(name))
    throw new Error(label+" cannot be mapped to a numeric or chemical metadata column.");
  if(!header.includes(name) || REQUIRED.some(field=>field===name)){
    throw new Error(label+" must identify a distinct existing metadata column.");
  }
  return header.indexOf(name);
}
function describeGroup(
  rows: string[][], index: number|null, value: string|undefined, label:string,
): {rows:string[][];value:string|undefined} {
  if(index===null) {
    if(value!==undefined)throw new Error(label+" value requires an explicit source column.");
    return {rows,value:undefined};
  }
  const options=new Set(rows.map(row=>row[index]?.trim()||""));
  if(options.has("")) throw new Error(label+" is missing for one or more source rows.");
  if(value!==undefined){
    const selected=nonempty(value,label+" value");
    const matching=rows.filter(row=>row[index].trim()===selected);
    if(!matching.length)throw new Error(label+" value did not match any rows.");
    return {rows:matching,value:selected};
  }
  if(options.size>1)throw new Error("Mixed "+label+" groups; select one exact value.");
  return {rows,value:[...options][0]};
}

/**
 * Accept only exact-matching source/solute/solvent records. Input must have
 * passed attestBigSolDB22Source; this parser is separately exported to
 * exercise synthetic fixtures but reports origin as UNVERIFIED.
 */
export function convertBigSolDB22Rows(
  csv:string, selection:BigSolDB22Selection,
  evidence:SourceEvidence,
):ResearchDataset {
  const compound=nonempty(selection.compound,"compound");
  const solvent=nonempty(selection.solvent,"solvent");
  const doi=nonempty(selection.doi,"source DOI",180);
  if(!DOI.test(doi)) throw new Error("Source DOI has an invalid format.");
  if(!/^[a-f0-9]{64}$/i.test(evidence.sha256) ||
     !/^[a-f0-9]{40}$/i.test(evidence.gitBlobSha1) ||
     !Number.isSafeInteger(evidence.byteLength)||evidence.byteLength<=0)
    throw new Error("Malformed source evidence.");
  // Library entry points can be fed a forged evidence object. Claims stay
  // explicitly unverified; command-line source intake performs actual hashing.
  const table=readCsvTable(csv);
  const header=table.shift()!;
  if(new Set(header).size!==header.length)throw new Error("Duplicate header names.");
  const map=new Map(header.map((field,index)=>[field,index]));
  for(const field of REQUIRED){
    if(!map.has(field)) throw new Error("Missing required BigSolDB v2.2 column: "+field);
  }
  const idx=(field:typeof REQUIRED[number])=>map.get(field)!;
  // Official v2.2 puts a solid_form_label in its 14-column main CSV.
  // Missing/unknown form can mean a polymorph was not reported; it must
  // never be silently grouped with an identified crystal form.
  if(header.includes("solid_form_label")&&!selection.solidFormColumn)
    throw new Error("Official v2.2 source requires explicit --solid-form-column solid_form_label.");
  const methodIndex=hasMappedColumn(selection.methodColumn,header,"measurement method");
  const formIndex=hasMappedColumn(selection.solidFormColumn,header,"solid form");
  if(methodIndex!==null&&methodIndex===formIndex)
    throw new Error("Method and solid-form columns must differ.");
  let matching=table.filter(row=>row[idx("Compound_Name")]===compound &&
    row[idx("Solvent")]===solvent &&
    row[idx("Source")].toLowerCase()===doi.toLowerCase());
  if(!matching.length) throw new Error("No records for the exact compound, solvent and DOI.");
  const byMethod=describeGroup(matching,methodIndex,selection.methodValue,"measurement method");
  matching=byMethod.rows;
  const byForm=describeGroup(matching,formIndex,selection.solidFormValue,"solid form");
  matching=byForm.rows;
  if(matching.length<5||matching.length>1000)
    throw new Error("One source-defined group must have 5..1000 rows.");
  for(const field of ["SMILES_Solute","SMILES_Solvent"] as const){
    if(new Set(matching.map(row=>row[idx(field)])).size!==1 ||
       matching.some(row=>!row[idx(field)]))
      throw new Error("Mixed or missing "+field+" chemical identity.");
  }
  const measurements=matching.map(row=>{
    const rawT=row[idx("Temperature_K")],rawX=row[idx("Solubility(mole_fraction)")];
    if(!rawT.trim()||!rawX.trim())throw new Error("Missing native temperature or mole fraction.");
    const temperature=Number(rawT),solubility=Number(rawX);
    if(!Number.isFinite(temperature)||temperature<=0||
       !Number.isFinite(solubility)||solubility<=0||solubility>=1)
      throw new Error("Invalid source-native Kelvin / mole fraction.");
    return {temperature,solubility};
  }).sort((a,b)=>a.temperature-b.temperature);
  for(let i=1;i<measurements.length;i++){
    if(measurements[i].temperature-measurements[i-1].temperature<1e-9)
      throw new Error("Duplicate temperatures; replicate protocol unresolved.");
  }
  return parseResearchDataset(JSON.stringify({
    schemaVersion:2,
    metadata:{
      title:"BigSolDB v2.2: "+compound+" / "+solvent+" ("+doi+")",
      sourceUrl:BIGSOLDB22_SOURCE.rawUrl,
      doi,
      authors:["Krasnov, L.","Malikov, D.","Kiseleva, M."],
      // Deliberately omit license: GitHub project README did not establish
      // which license applies to these source rows or underlying articles.
      provenance:"unverified",
      experimentMode:"equilibrium_curve",
      material:compound,solvent,
      processType:"literature-compiled equilibrium solubility; not kinetics",
      concentrationBasis:"mole_fraction",
      temperatureSource:"unknown",
      measurementMethod:byMethod.value,
      solidForm:byForm.value,
      units:{temperature:"K",solubility:"mole_fraction"},
      sourceFileSha256:evidence.sha256,
      transformations:[{
        operation:"source_mapping",software:"crystaltwin-bigsoldb22-intake",
        version:"1.0",inputSha256:evidence.sha256,
        notes:"Exact source DOI, chemical identity, solvent and optional method/form grouping. Git blob SHA-1 "+evidence.gitBlobSha1,
      }],
      notes:"Derived from BigSolDB v2.2 compilation Git blob "+evidence.gitBlobSha1+
        ". Source article, raw experiment, original solid-form interpretation and redistribution rights not independently authenticated. No liquid-volume conversion, kinetics or hardware use.",
    },
    measurements,
  }));
}

export function convertOfficialBigSolDB22(
  bytes:Uint8Array, selection:BigSolDB22Selection,
):ResearchDataset {
  const evidence=attestBigSolDB22Source(bytes);
  const csv=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  return convertBigSolDB22Rows(csv,selection,evidence);
}

function runCli(){
  const args=process.argv.slice(2);
  const option=(flag:string,required=false):string|undefined=>{
    const index=args.indexOf(flag);
    if(index<0){if(required)throw new Error("Missing "+flag);return undefined;}
    if(!args[index+1]||args[index+1].startsWith("--"))throw new Error("Missing value "+flag);
    return args[index+1];
  };
  const source=option("--source",true)!;
  const bytes=readFileSync(source);
  const selected:BigSolDB22Selection={
    compound:option("--compound",true)!,
    solvent:option("--solvent",true)!,
    doi:option("--doi",true)!,
    methodColumn:option("--method-column"),
    solidFormColumn:option("--solid-form-column"),
    methodValue:option("--method-value"),
    solidFormValue:option("--solid-form-value"),
  };
  const dataset=convertOfficialBigSolDB22(bytes,selected);
  const serialized=JSON.stringify(dataset,null,2)+"\n";
  if(Buffer.byteLength(serialized)>1024*1024)throw Error("Export exceeds 1 MiB.");
  writeFileSync(option("--out",true)!,serialized,{flag:"wx"});
  process.stdout.write("Imported "+dataset.measurements.length+
    " source-native points. SHA-256: "+dataset.metadata.sourceFileSha256+"\n");
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/import-bigsoldb22.ts")){
  try{runCli()}catch(e){console.error(e instanceof Error?e.message:e);process.exitCode=1;}
}
