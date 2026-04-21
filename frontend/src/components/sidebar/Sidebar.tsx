// @ts-nocheck
import ProjectSection from "./ProjectSection";
import PropertySection from "./PropertySection";
import StationSection from "./StationSection";
import TerrainSection from "./TerrainSection";
import InfiltrationSection from "./InfiltrationSection";
import CalculationSection from "./CalculationSection";

export default function Sidebar(props) {
  return (
    <aside className="order-2 overflow-y-auto border-t border-slate-200 bg-[#F6F8FF] p-4 lg:order-1 lg:border-r lg:border-t-0 dark:border-slate-800 dark:bg-slate-950">
      <div className="space-y-5">
        <ProjectSection
          projectName={props.form.projectName}
          setField={props.setField}
        />

<PropertySection
  municipalityNumber={props.municipalityNumber}
  cadastralNumber={props.cadastralNumber}
  propertyNumber={props.propertyNumber}
  setMunicipalityNumber={props.setMunicipalityNumber}
  setCadastralNumber={props.setCadastralNumber}
  setPropertyNumber={props.setPropertyNumber}
  onLookup={props.handleMatrikkelLookup}
  loading={props.matrikkelLoading}
  address={props.propertyAddress}
  matrikkel={props.propertyMatrikkel}
  error={props.propertyError}
  propertyLoading={props.propertyLoading}
/>

<StationSection
  stations={props.weatherStations}
  selectedStationId={props.selectedStationId}
  setSelectedStationId={props.setSelectedStationId}
  search={props.stationSearch}
  setSearch={props.setStationSearch}
  dropdownOpen={props.stationDropdownOpen}
  setDropdownOpen={props.setStationDropdownOpen}
  stationBoxRef={props.stationBoxRef}

/>

        <TerrainSection
          elevation={props.elevation}
          length={props.length}
          concentrationTime={props.concentrationTime}
          loading={props.terrainLoading}
          error={props.terrainError}
          propertyLoading={props.propertyLoading}
        />

        <InfiltrationSection
          form={props.form}
          setField={props.setField}
          soilTypes={props.soilTypes}
        />

        <CalculationSection
          form={props.form}
          setField={props.setField}
          onGenerate={props.handleGeneratePdf}
          loading={props.pdfSaving}
          error={props.pdfError}
          onReset={props.handleReset}
        />
      </div>
    </aside>
  );
}