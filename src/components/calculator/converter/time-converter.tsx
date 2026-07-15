import { getUnitGroup } from '../utils/units'
import { UnitConverter } from './unit-converter'

export function TimeConverter() {
  const group = getUnitGroup('time')!
  return <UnitConverter group={group} />
}
