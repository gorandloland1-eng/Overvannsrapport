// @ts-nocheck
import ProjectSection from "./ProjectSection";
import PropertySection from "./PropertySection";
import StationSection from "./StationSection";
import TerrainSection from "./TerrainSection";
import InfiltrationSection from "./InfiltrationSection";
import CalculationSection from "./CalculationSection";

export default function Sidebar(props) {
  const errors = props.validationErrors ?? {};

  return (
    <aside className="h-full min-h-0 overflow-y-auto border-slate-200 bg-[#F6F8FF] p-4 dark:border-slate-800 dark:bg-slate-950 xl:border-l">
      <div className="space-y-5">
        <ProjectSection
          projectName={props.form.projectName}
          setField={props.setField}
          error={errors.projectName}
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
          validationErrors={{
            municipalityNumber: errors.municipalityNumber,
            cadastralNumber: errors.cadastralNumber,
            propertyNumber: errors.propertyNumber,
          }}
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
          error={errors.selectedStationId}
        />

        <TerrainSection
          elev1={props.elev1}
          elev2={props.elev2}
          heightDifference={props.heightDifference}
          length={props.length}
          concentrationTime={props.concentrationTime}
          loading={props.terrainLoading}
          error={props.terrainError}
          propertyLoading={props.propertyLoading}
          validationErrors={{
            heightDifference: errors.heightDifference,
            concentrationTime: errors.concentrationTime,
          }}
        />

        <InfiltrationSection
          form={props.form}
          setField={props.setField}
          soilTypes={props.soilTypes}
          error={errors.infiltration}
        />

        <CalculationSection
          form={props.form}
          setField={props.setField}
          onGenerate={props.handleGeneratePdf}
          loading={props.pdfSaving}
          error={props.pdfError}
          onReset={props.handleReset}
          validationErrors={{
            area: errors.area,
            climateFactor: errors.climateFactor,
          }}
        />
      </div>
    </aside>
  );
}