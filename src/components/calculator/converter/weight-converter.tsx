import { getUnitGroup } from '../utils/units'
import { UnitConverter } from './unit-converter'

export function WeightConverter() {
  const group = getUnitGroup('weight')!
  return <UnitConverter group={group} />
}
