/**
 * Small, transparently attributed secondary-compilation samples.
 * These are NOT authenticated original laboratory records and are
 * never routed into the educational simulator or the synthetic PBE.
 */
export const SOURCE_GALLERY = [
  {
    id:"paracetamol-ethanol",material:"Paracetamol",formula:"C8H9NO2",
    doi:"10.1007/s10953-005-9007-8",points:5,
    path:"/examples/bigsoldb21-paracetamol-ethanol.measured.json",
    provenance:"secondary_compilation_viewer_sample" as const,
    temperatureRangeK:[293.15,313.15] as const,
    hue:"cyan" as const,
  },
  {
    id:"succinic-ethanol",material:"Succinic acid",formula:"C4H6O4",
    doi:"10.1007/s10953-012-9951-z",points:12,
    path:"/examples/bigsoldb21-succinic-acid-ethanol.measured.json",
    provenance:"secondary_compilation_viewer_sample" as const,
    temperatureRangeK:[278.15,333.15] as const,
    hue:"cyan" as const,
  },
  {
    id:"isoimperatorin-ethanol",material:"Isoimperatorin",formula:"C16H14O4",
    doi:"10.1007/s10953-012-9917-1",points:9,
    path:"/examples/bigsoldb21-isoimperatorin-ethanol.measured.json",
    provenance:"secondary_compilation_viewer_sample" as const,
    temperatureRangeK:[288.2,328.2] as const,
    hue:"violet" as const,
  },
] as const;
export const SOURCE_COMPILATION={
  title:"BigSolDB v2.1",url:"https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1",
  referenceDoi:"10.1038/s41597-025-05559-8",
  compilationLicense:"CC BY 4.0" as const,
  originalArticleRightsAuthenticated:false as const,
  rawInstrumentFilesAuthenticated:false as const,
  publishedViewerRowsOnly:true as const,
};
export const EXTERNAL_SOURCE_CANDIDATES=[
  {
    title:"Lovastatin: growth / nucleation / solubility",
    url:"https://pureportal.strath.ac.uk/en/datasets/data-for-benchmarking-model-based-design-of-experiment-approaches/",
    doi:"10.15129/39b0828f-082a-4e71-88a1-f0d67aab4375",
    license:"CC BY-NC-ND",
    status:"external_reference_only_licensing_review" as const,
    modality:"Original reported solubility, crystal growth and nucleation data",
  },
  {
    title:"Zeolite crystallization: Raman and XRD",
    url:"https://zenodo.org/records/18972297",
    doi:"10.5281/zenodo.18972297",
    license:"license_not_verified",
    status:"external_reference_only_protocol_review" as const,
    modality:"NeXus files, in situ spectroscopy and ex situ powder diffraction",
  },
] as const;
