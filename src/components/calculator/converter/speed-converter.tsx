import { getUnitGroup } from '../utils/units'
import { UnitConverter } from './unit-converter'

export function SpeedConverter() {
  const group = getUnitGroup('speed')!
  return <UnitConverter group={group} />
}
