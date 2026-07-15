import { getUnitGroup } from '../utils/units'
import { UnitConverter } from './unit-converter'

export function LengthConverter() {
  const group = getUnitGroup('length')!
  return <UnitConverter group={group} />
}
