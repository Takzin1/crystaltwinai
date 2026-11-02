/**
 * Reproducible ORIGINAL-BYTES audit. Never automatically fetch source data:
 * the GitHub Actions workflow downloads pinned public files into RUNNER_TEMP.
 *
 * Result: metadata-only SHA digests, original row counts, measured-source
 * selection evidence and explicit scientific/license limitations. No large
 * source CSV, records or derived source values are copied into artifacts.
 */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BIGSOLDB21_SOURCE,readCsvTable,verifyBigSolDB21Blob,convertBigSolDB21 } from "./import-bigsoldb21";
import { BIGSOLDB22_SOURCE,attestBigSolDB22Source,convertOfficialBigSolDB22 } from "./import-bigsoldb22";
import { auditBigSolDB22SourceProtocol } from "../src/lib/bigsoldb22-protocol";

export const RAW_AUDIT_SCHEMA="crystaltwin-source-byte-audit/1" as const;
export const SOURCE_TABLE_SHAPES={
  v21:{file:"BigSolDBv2_1.csv",expectedRows:112465,columns:[
    "SMILES_Solute","Temperature_K","Solvent","SMILES_Solvent",
    "Solubility(mole_fraction)","Solubility(mol/L)","LogS(mol/L)",
    "Compound_Name","CAS","PubChem_CID","FDA_Approved","Source"]},
  v22:{file:"BigSolDBv2.2.csv",expectedRows:125752,columns:[
    "SMILES_Solute","Temperature_K","Solvent","SMILES_Solvent",
    "Solubility(mole_fraction)","Solubility(mol/L)","LogS(mol/L)",
    "LogS(mole_fraction)","Compound_Name","CAS","PubChem_CID",
    "FDA_Approved","Source","solid_form_label"]},
  methods:{file:"BigSolDBv2.2_methods.csv",expectedRows:1842,columns:[
    "doi","solubility_type","method","equilibration_h","settling_h",
    "agitation_type","agitation_rpm","temperature_control","pressure_kPa","replicates"]},
  solidForms:{file:"BigSolDBv2.2_solid_forms.csv",expectedRows:2295,columns:[
    "doi","CAS","SMILES_Solute","solid_form_label","solute_purity",
    "purity_method","solute_supplier","solid_phase_control",
    "phase_change_observed","solid_form","melting_point_K",
    "melting_point_method","decomposition_temperature_K",
    "fusion_enthalpy_kJ_mol","fusion_enthalpy_source"]},
} as const;
export const SOURCE_DIGESTS={
  v21:{
    gitBlobSha1:BIGSOLDB21_SOURCE.gitBlobSha1,
    sizeBytes:BIGSOLDB21_SOURCE.sizeBytes,
    // Independently published by the author's HuggingFace LFS pointer:
    // https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1/blob/main/BigSolDBv2.1.csv
    huggingFaceSha256:"212cb511e05051917f7ab8811282c06c99512e4f720cf270be555fdf07b4a854",
  },
  v22:{
    gitBlobSha1:BIGSOLDB22_SOURCE.gitBlobSha1,
    sizeBytes:BIGSOLDB22_SOURCE.sizeBytes,
    // Zenodo record https://zenodo.org/records/22648301 lists file digests.
    zenodoMd5:"a1e12ae9575319ac4f89fea6a63a6422",
  },
  methods:{zenodoMd5:"4e7a688055d0e8ebf4c8c3a202b29b7c"},
  solidForms:{zenodoMd5:"3a077abad5373f52341f7915a9a38757"},
} as const;
const fileDigest=(bytes:Uint8Array,algorithm:"md5"|"sha256")=>
  createHash(algorithm).update(bytes).digest("hex");
function preciseRows(
  bytes:Uint8Array,
  key:keyof typeof SOURCE_TABLE_SHAPES,
):{count:number;columns:string[];table:string[][]} {
  if(bytes.byteLength>32*1024*1024)throw new Error("Source unexpectedly exceeds 32 MiB.");
  const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  const table=readCsvTable(text);
  const header=table.shift()!;
  const expected=SOURCE_TABLE_SHAPES[key];
  if(header.length!==expected.columns.length || expected.columns.some((c,i)=>header[i]!==c))
    throw new Error("Official "+key+" CSV column contract differs from published schema.");
  if(table.length!==expected.expectedRows)
    throw new Error("Official "+key+" reported row count changed: "+table.length);
  return {count:table.length,columns:header,table};
}
function digestRow(bytes:Uint8Array) {
  return {sha256:fileDigest(bytes,"sha256"),md5:fileDigest(bytes,"md5"),sizeBytes:bytes.byteLength};
}
export function verifyKnownFullSourceHeaderFixture(
  key:keyof typeof SOURCE_TABLE_SHAPES, sampleCsv:string,
) {
  const a=SOURCE_TABLE_SHAPES[key].columns;
  const actual=readCsvTable(sampleCsv)[0];
  if(actual.length!==a.length||a.some((c,i)=>c!==actual[i]))
    throw new Error("Official "+key+" header differs.");
  return [...actual];
}
function requireDigest(observed:string,expected:string,label:string){
  if(observed!==expected)throw new Error(label+" published digest mismatch.");
}
/** Only returns counts/metadata; never returns a raw record or CSV. */
export function auditOriginalBigSolDBFiles(input:{
  v21:Uint8Array;v22:Uint8Array;methods:Uint8Array;solidForms:Uint8Array;
}){
  const v21Sha=verifyBigSolDB21Blob(input.v21);
  requireDigest(v21Sha,SOURCE_DIGESTS.v21.huggingFaceSha256,"v2.1 HF SHA-256");
  const v22Attestation=attestBigSolDB22Source(input.v22);
  const v21Digest=digestRow(input.v21);
  const v22Digest=digestRow(input.v22);
  requireDigest(v22Digest.md5,SOURCE_DIGESTS.v22.zenodoMd5,"v2.2 Zenodo MD5");
  const methodsDigest=digestRow(input.methods);
  requireDigest(methodsDigest.md5,SOURCE_DIGESTS.methods.zenodoMd5,"methods Zenodo MD5");
  const formsDigest=digestRow(input.solidForms);
  requireDigest(formsDigest.md5,SOURCE_DIGESTS.solidForms.zenodoMd5,"solid-form Zenodo MD5");
  const v21=preciseRows(input.v21,"v21");
  const v22=preciseRows(input.v22,"v22");
  const methods=preciseRows(input.methods,"methods");
  const solidForms=preciseRows(input.solidForms,"solidForms");
  const paracetamol=convertBigSolDB21(
    new TextDecoder("utf-8",{fatal:true}).decode(input.v21),
    {compound:"Paracetamol",solvent:"ethanol",doi:"10.1007/s10953-005-9007-8"},v21Sha);
  const expectedT=[293.15,298.15,303.15,308.15,313.15];
  const expectedX=[.05045,.0546,.062,.067,.0705];
  if(paracetamol.measurements.length!==5 ||
    paracetamol.measurements.some((row,i)=>
      Math.abs(row.temperature!-expectedT[i])>1e-9||
      Math.abs(row.solubility!-expectedX[i])>1e-12))
    throw new Error("Original v2.1 paracetamol 5-point source-to-JSON mapping regression.");
  const ix=(c:string)=>v22.columns.indexOf(c);
  const groups=new Map<string,string[][]>();
  const doiRegex=/^10\.\d{4,9}\/\S+$/i;
  for(const row of v22.table){
    const form=row[ix("solid_form_label")].trim();
    const doi=row[ix("Source")];
    const temperature=Number(row[ix("Temperature_K")]);
    const moleFraction=Number(row[ix("Solubility(mole_fraction)")]);
    if(!form||!doiRegex.test(doi)||!(temperature>0)||!(moleFraction>0&&moleFraction<1))
      continue;
    const key=JSON.stringify([row[ix("Compound_Name")],row[ix("Solvent")],doi,form]);
    const group=groups.get(key)??[];
    group.push(row);groups.set(key,group);
  }
  const ordered=[...groups.entries()].filter(([,rows])=>
    rows.length>=5&&rows.length<=1000&&
    new Set(rows.map(r=>r[ix("Temperature_K")])).size===rows.length&&
    new Set(rows.map(r=>r[ix("SMILES_Solute")])).size===1&&
    new Set(rows.map(r=>r[ix("SMILES_Solvent")])).size===1
  ).sort(([a],[b])=>a.localeCompare(b));
  let selected:null|{
    compound:string;solvent:string;doi:string;solidForm:string;
    convertedCount:number;protocolEligible:boolean;protocolFlags:string[];
  }=null;
  const originalCsv=new TextDecoder("utf-8",{fatal:true}).decode(input.v22);
  const methodsCsv=new TextDecoder("utf-8",{fatal:true}).decode(input.methods);
  const formsCsv=new TextDecoder("utf-8",{fatal:true}).decode(input.solidForms);
  // Try a small bounded subset; ineligible forms remain unverified rather
  // than being converted from unknown/mixed phase observations.
  for(const [key,rows] of ordered.slice(0,30)){
    const [compound,solvent,doi,solidForm]=JSON.parse(key) as string[];
    if(!solidForm||!compound||!solvent)continue;
    try {
      const converted=convertOfficialBigSolDB22(input.v22,{
        compound,solvent,doi,solidFormColumn:"solid_form_label",solidFormValue:solidForm,
      });
      const expected=rows.map(r=>({
        temperature:Number(r[ix("Temperature_K")]),
        solubility:Number(r[ix("Solubility(mole_fraction)")]),
      })).sort((a,b)=>a.temperature-b.temperature);
      if(converted.measurements.length!==expected.length||
        converted.measurements.some((m,i)=>
          m.temperature!==expected[i].temperature||
          m.solubility!==expected[i].solubility))
        throw new Error("Converted v2.2 source values differ from original rows.");
      const protocol=auditBigSolDB22SourceProtocol(methodsCsv,formsCsv,{
        doi,cas:rows[0][ix("CAS")],
        smilesSolute:rows[0][ix("SMILES_Solute")],
        solidFormLabel:solidForm,
      });
      selected={
        compound,solvent,doi,solidForm,
        convertedCount:converted.measurements.length,
        protocolEligible:protocol.comparabilityGate.eligibleForFurtherReview,
        protocolFlags:protocol.comparabilityGate.flags,
      };
      break;
    }catch(err){
      // Some paper/compound groups have incomplete companion metadata.
      // Continue searching, but NEVER invent metadata to make a join pass.
    }
  }
  if(!selected)
    throw new Error("No exact solid-form + method companion matched v2.2 conversion among first 30 eligible groups; original data mapping requires review.");
  return {
    schema:RAW_AUDIT_SCHEMA,
    source:{
      v21:{...v21Digest,gitBlobSha1:BIGSOLDB21_SOURCE.gitBlobSha1,
        sourceCommit:BIGSOLDB21_SOURCE.commit,rowCount:v21.count,header:v21.columns,
        hfSha256Matched:true},
      v22:{...v22Digest,gitBlobSha1:v22Attestation.gitBlobSha1,
        sourceCommit:BIGSOLDB22_SOURCE.commit,rowCount:v22.count,header:v22.columns,
        zenodoMd5Matched:true},
      methods:{...methodsDigest,rowCount:methods.count,header:methods.columns,zenodoMd5Matched:true},
      solidForms:{...formsDigest,rowCount:solidForms.count,header:solidForms.columns,zenodoMd5Matched:true},
    },
    originalSourceConversion:{
      v21ParacetamolEthanol:{
        count:paracetamol.measurements.length,doi:paracetamol.metadata.doi,
        nativeUnits:"K + solute mole fraction",
        originalRowsMatched:true,primaryPaperAuthenticated:false,
      },
      v22SolidFormGroup:{
        ...selected,originalRowsMatched:true,primaryPaperAuthenticated:false,
        companionSourcesMatchedByDeclaredKeys:true,
      },
    },
    scientificClaims:{
      fullOriginalCsvBytesVerified:true,
      nativeRowMappingExecuted:true,
      experimentalMethodIndependentlyReproduced:false,
      originalPrimaryMeasurementAuthenticated:false,
      physicalPbePredictionValidated:false,
      v22RedistributionRightsIndependentlyVerified:false,
      exportedRawDataset:false,
    },
    caveats:[
      "Provenance verified at the exact downloaded bytes level, not the original laboratory instrument or article level.",
      "No v2.2 raw/derived data rows are redistributed by this metadata-only report.",
      "Methods and solid forms match declared table keys, not independently replicated laboratory protocols.",
      "The imported mole fraction is not interchangeable with mol/L of solution or derived mol/L of pure solvent.",
      "No external kinetic or particle-size measurements are used to calibrate or validate the PBE.",
    ],
  };
}
function cli(){
  const argv=process.argv.slice(2);
  const arg=(name:string)=>{
    const i=argv.indexOf(name);
    if(i<0||!argv[i+1])throw new Error("Missing "+name);
    return argv[i+1];
  };
  const report=auditOriginalBigSolDBFiles({
    v21:readFileSync(arg("--v21")),v22:readFileSync(arg("--v22")),
    methods:readFileSync(arg("--methods")),solidForms:readFileSync(arg("--forms")),
  });
  const out=arg("--out");
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({
    audit:report.schema,
    originalSourceValidation:"pass",
    rowCounts:Object.fromEntries(Object.entries(report.source).map(([k,v])=>[k,v.rowCount])),
    sourceHashes:Object.fromEntries(Object.entries(report.source).map(([k,v])=>[k,v.sha256])),
    transformedV21:report.originalSourceConversion.v21ParacetamolEthanol.count,
    transformedV22:report.originalSourceConversion.v22SolidFormGroup.convertedCount,
    originalLabDataAuthenticated:false,
    v22RedistributionPermissionEstablished:false,
    artifact:out,
  },null,2));
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/audit-bigsoldb-raw.ts")){
  try{cli();}catch(err){console.error(err instanceof Error?err.message:String(err));process.exitCode=1;}
}
