from dataclasses import dataclass
from typing import Optional

@dataclass
class ArealPost:
    areal_m2: float
    type_areal: str
    avrenningsfaktor: Optional[float] = None

    def get_avrenningsfaktor(self, avrenningsfaktorer: dict) -> float:
        if self.avrenningsfaktor is not None:
            return self.avrenningsfaktor
        return avrenningsfaktorer.get(self.type_areal, 0.0)


@dataclass
class IVFData:
    stasjon: str
    periode: str
    data: dict


@dataclass
class InfiltrasjonData:
    hydraulisk_konduktivitet_m_s: float
    areal_bunnflate_m2: float
    areal_sideflater_m2: float
    sikkerhetsfaktor_bunn: float = 0.5
    sikkerhetsfaktor_sideflater: float = 1.0

    @property
    def effektivt_infiltrasjonsareal_m2(self) -> float:
        return (
            self.areal_bunnflate_m2 * self.sikkerhetsfaktor_bunn +
            self.areal_sideflater_m2 * self.sikkerhetsfaktor_sideflater
        )

    @property
    def infiltrasjonskapasitet_l_s(self) -> float:
        return self.hydraulisk_konduktivitet_m_s * self.effektivt_infiltrasjonsareal_m2 * 1000